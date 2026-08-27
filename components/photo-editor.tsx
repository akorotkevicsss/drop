import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import {
  ImageManipulator,
  SaveFormat,
} from 'expo-image-manipulator';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { captureRef } from 'react-native-view-shot';

import {
  DropColors,
  DropTypography,
} from '@/constants/theme';

type DrawStroke = {
  d: string;
  width: number;
  color: string;
};

type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Props = {
  uri: string;
  width: number;
  height: number;
  onCancel: () => void;
  onDone: (result: {
    uri: string;
    width: number;
    height: number;
    mimeType: string;
  }) => void;
};

const SCREEN_WIDTH =
  Dimensions.get('window').width;

const CROP_STAGE_HEIGHT = 520;
const CROP_MIN_SIZE = 72;

function centerCrop(
  width: number,
  height: number,
  targetRatio: number
) {
  const sourceRatio =
    width / height;

  if (sourceRatio > targetRatio) {
    const cropWidth =
      Math.round(
        height *
          targetRatio
      );

    return {
      originX:
        Math.round(
          (width -
            cropWidth) /
            2
        ),
      originY: 0,
      width:
        cropWidth,
      height,
    };
  }

  const cropHeight =
    Math.round(
      width /
        targetRatio
    );

  return {
    originX: 0,
    originY:
      Math.round(
        (height -
          cropHeight) /
          2
      ),
    width,
    height:
      cropHeight,
  };
}

export function PhotoEditor({
  uri,
  width,
  height,
  onCancel,
  onDone,
}: Props) {
  const originalUri =
    uri;

  const originalWidth =
    width;

  const originalHeight =
    height;

  const [
    rotation,
    setRotation,
  ] =
    useState(0);

  const [
    selectedRatio,
    setSelectedRatio,
  ] =
    useState<
      number | null
    >(null);

  const [
    workingUri,
    setWorkingUri,
  ] =
    useState(uri);

  const [
    workingWidth,
    setWorkingWidth,
  ] =
    useState(width);

  const [
    workingHeight,
    setWorkingHeight,
  ] =
    useState(height);

  const [
    drawMode,
    setDrawMode,
  ] =
    useState(false);

  const [
    drawWidth,
    setDrawWidth,
  ] =
    useState(5);

  const [
    drawColor,
    setDrawColor,
  ] =
    useState(
      DropColors.warmWhite
    );

  const [
    strokes,
    setStrokes,
  ] =
    useState<
      DrawStroke[]
    >([]);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    cropMode,
    setCropMode,
  ] = useState(false);

  const [
    cropLockedRatio,
    setCropLockedRatio,
  ] = useState<number | null>(
    null
  );

  const [
    cropScale,
    setCropScale,
  ] = useState(1);

  const [
    cropOffset,
    setCropOffset,
  ] = useState({ x: 0, y: 0 });

  const [
    cropRect,
    setCropRect,
  ] = useState<CropRect>({
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  });

  const cropPinchStartDistance =
    useRef(0);

  const cropPinchStartScale =
    useRef(1);

  const cropLastGesture =
    useRef({ x: 0, y: 0 });

  const cropResizeStartRect =
    useRef<CropRect>({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });

  const cropScaleRef =
    useRef(1);

  const cropOffsetRef =
    useRef({ x: 0, y: 0 });

  const cropRectRef =
    useRef<CropRect>({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    });

  const cropModeRef =
    useRef(false);

  useEffect(
    () => {
      cropScaleRef.current =
        cropScale;
    },
    [cropScale]
  );

  useEffect(
    () => {
      cropOffsetRef.current =
        cropOffset;
    },
    [cropOffset]
  );

  useEffect(
    () => {
      cropRectRef.current =
        cropRect;
    },
    [cropRect]
  );

  useEffect(
    () => {
      cropModeRef.current =
        cropMode;
    },
    [cropMode]
  );

  const canvasRef =
    useRef<View>(
      null
    );

  const currentPath =
    useRef('');

  const canvasWidth =
    SCREEN_WIDTH -
    24;

  const previewRatio =
    selectedRatio ??
    (
      workingWidth /
      Math.max(
        workingHeight,
        1
      )
    );

  const canvasHeight =
    Math.min(
      540,
      Math.max(
        220,
        canvasWidth /
          Math.max(
            previewRatio,
            0.01
          )
      )
    );

  const cropStageWidth =
    SCREEN_WIDTH - 24;

  const cropStageHeight =
    CROP_STAGE_HEIGHT;

  const makeFixedRatioRect = (
    ratio: number
  ): CropRect => {
    const padding = 18;
    const maxWidth =
      cropStageWidth -
      padding * 2;
    const maxHeight =
      cropStageHeight -
      padding * 2;

    let rectWidth =
      maxWidth;
    let rectHeight =
      rectWidth /
      ratio;

    if (
      rectHeight >
      maxHeight
    ) {
      rectHeight =
        maxHeight;
      rectWidth =
        rectHeight *
        ratio;
    }

    return {
      x:
        (
          cropStageWidth -
          rectWidth
        ) / 2,
      y:
        (
          cropStageHeight -
          rectHeight
        ) / 2,
      width:
        rectWidth,
      height:
        rectHeight,
    };
  };

  const cropBaseScale =
    Math.min(
      cropStageWidth /
        Math.max(workingWidth, 1),
      cropStageHeight /
        Math.max(workingHeight, 1)
    );

  const cropBaseDisplayWidth =
    workingWidth * cropBaseScale;

  const cropBaseDisplayHeight =
    workingHeight * cropBaseScale;

  const getCropDisplaySize = (
    scale: number
  ) => ({
    width:
      cropBaseDisplayWidth * scale,
    height:
      cropBaseDisplayHeight * scale,
  });

  const getCropImageBounds = (
    scale = cropScale,
    offset = cropOffset
  ) => {
    const display =
      getCropDisplaySize(scale);

    const left =
      cropStageWidth / 2 -
      display.width / 2 +
      offset.x;

    const top =
      cropStageHeight / 2 -
      display.height / 2 +
      offset.y;

    return {
      left,
      top,
      right:
        left + display.width,
      bottom:
        top + display.height,
      width:
        display.width,
      height:
        display.height,
    };
  };

  const getMinimumCropScale = (
    rect: CropRect
  ) =>
    Math.max(
      rect.width /
        Math.max(
          cropBaseDisplayWidth,
          1
        ),
      rect.height /
        Math.max(
          cropBaseDisplayHeight,
          1
        ),
      0.2
    );

  const clampCropOffset = (
    x: number,
    y: number,
    scale: number,
    rect: CropRect = cropRect
  ) => {
    const display =
      getCropDisplaySize(scale);

    const minX =
      rect.x +
      rect.width -
      cropStageWidth / 2 -
      display.width / 2;

    const maxX =
      rect.x -
      cropStageWidth / 2 +
      display.width / 2;

    const minY =
      rect.y +
      rect.height -
      cropStageHeight / 2 -
      display.height / 2;

    const maxY =
      rect.y -
      cropStageHeight / 2 +
      display.height / 2;

    return {
      x:
        minX <= maxX
          ? Math.max(
              minX,
              Math.min(maxX, x)
            )
          : x,
      y:
        minY <= maxY
          ? Math.max(
              minY,
              Math.min(maxY, y)
            )
          : y,
    };
  };

  const distanceBetweenTouches = (
    touches: readonly {
      pageX: number;
      pageY: number;
    }[]
  ) => {
    if (touches.length < 2) {
      return 0;
    }

    const dx =
      touches[1].pageX -
      touches[0].pageX;
    const dy =
      touches[1].pageY -
      touches[0].pageY;

    return Math.sqrt(
      dx * dx + dy * dy
    );
  };

  const cropPanResponder =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () =>
              cropModeRef.current,

          onMoveShouldSetPanResponder:
            (
              _,
              gesture
            ) =>
              cropModeRef.current &&
              (
                Math.abs(
                  gesture.dx
                ) >
                  1 ||
                Math.abs(
                  gesture.dy
                ) >
                  1
              ),

          onPanResponderGrant:
            (event) => {
              cropLastGesture.current = {
                x: 0,
                y: 0,
              };

              const touches =
                event.nativeEvent
                  .touches;

              if (
                touches.length >= 2
              ) {
                cropPinchStartDistance.current =
                  distanceBetweenTouches(
                    touches
                  );

                cropPinchStartScale.current =
                  cropScaleRef.current;
              }
            },

          onPanResponderMove:
            (
              event,
              gesture
            ) => {
              if (
                !cropModeRef.current
              ) {
                return;
              }

              const touches =
                event.nativeEvent
                  .touches;

              if (
                touches.length >= 2
              ) {
                const distance =
                  distanceBetweenTouches(
                    touches
                  );

                if (
                  cropPinchStartDistance.current <=
                  0
                ) {
                  cropPinchStartDistance.current =
                    distance;

                  cropPinchStartScale.current =
                    cropScaleRef.current;

                  cropLastGesture.current =
                    {
                      x:
                        gesture.dx,
                      y:
                        gesture.dy,
                    };

                  return;
                }

                const currentRect =
                  cropRectRef.current;

                const minimumScale =
                  getMinimumCropScale(
                    currentRect
                  );

                const nextScale =
                  Math.max(
                    minimumScale,
                    Math.min(
                      5,
                      cropPinchStartScale.current *
                        (
                          distance /
                          Math.max(
                            cropPinchStartDistance.current,
                            1
                          )
                        )
                    )
                  );

                const currentOffset =
                  cropOffsetRef.current;

                const nextOffset =
                  clampCropOffset(
                    currentOffset.x,
                    currentOffset.y,
                    nextScale,
                    currentRect
                  );

                cropScaleRef.current =
                  nextScale;

                cropOffsetRef.current =
                  nextOffset;

                setCropScale(
                  nextScale
                );

                setCropOffset(
                  nextOffset
                );

                cropLastGesture.current =
                  {
                    x:
                      gesture.dx,
                    y:
                      gesture.dy,
                  };

                return;
              }

              cropPinchStartDistance.current =
                0;

              const deltaX =
                gesture.dx -
                cropLastGesture.current
                  .x;

              const deltaY =
                gesture.dy -
                cropLastGesture.current
                  .y;

              cropLastGesture.current =
                {
                  x:
                    gesture.dx,
                  y:
                    gesture.dy,
                };

              const currentOffset =
                cropOffsetRef.current;

              const currentScale =
                cropScaleRef.current;

              const currentRect =
                cropRectRef.current;

              const nextOffset =
                clampCropOffset(
                  currentOffset.x +
                    deltaX,
                  currentOffset.y +
                    deltaY,
                  currentScale,
                  currentRect
                );

              cropOffsetRef.current =
                nextOffset;

              setCropOffset(
                nextOffset
              );
            },

          onPanResponderRelease:
            () => {
              cropPinchStartDistance.current =
                0;

              cropPinchStartScale.current =
                cropScaleRef.current;

              cropLastGesture.current =
                {
                  x: 0,
                  y: 0,
                };
            },

          onPanResponderTerminate:
            () => {
              cropPinchStartDistance.current =
                0;

              cropLastGesture.current =
                {
                  x: 0,
                  y: 0,
                };
            },

          onPanResponderTerminationRequest:
            () => false,
        }),
      []
    );

  const makeCropResizeResponder = (
    edges: {
      left?: boolean;
      right?: boolean;
      top?: boolean;
      bottom?: boolean;
    }
  ) =>
    PanResponder.create({
      onStartShouldSetPanResponder:
        () =>
          cropModeRef.current,

      onMoveShouldSetPanResponder:
        (
          _,
          gesture
        ) =>
          cropModeRef.current &&
          (
            Math.abs(
              gesture.dx
            ) >
              1 ||
            Math.abs(
              gesture.dy
            ) >
              1
          ),

      onPanResponderGrant:
        () => {
          cropResizeStartRect.current =
            {
              ...cropRectRef.current,
            };
        },

      onPanResponderMove:
        (
          _,
          gesture
        ) => {
          if (
            !cropModeRef.current
          ) {
            return;
          }

          const start =
            cropResizeStartRect.current;

          const currentScale =
            cropScaleRef.current;

          const currentOffset =
            cropOffsetRef.current;

          const imageBounds =
            getCropImageBounds(
              currentScale,
              currentOffset
            );

          const boundLeft =
            Math.max(
              0,
              imageBounds.left
            );

          const boundTop =
            Math.max(
              0,
              imageBounds.top
            );

          const boundRight =
            Math.min(
              cropStageWidth,
              imageBounds.right
            );

          const boundBottom =
            Math.min(
              cropStageHeight,
              imageBounds.bottom
            );

          let left =
            start.x;

          let top =
            start.y;

          let right =
            start.x +
            start.width;

          let bottom =
            start.y +
            start.height;

          if (edges.left) {
            left =
              Math.max(
                boundLeft,
                Math.min(
                  right -
                    CROP_MIN_SIZE,
                  start.x +
                    gesture.dx
                )
              );
          }

          if (edges.right) {
            right =
              Math.min(
                boundRight,
                Math.max(
                  left +
                    CROP_MIN_SIZE,
                  start.x +
                    start.width +
                    gesture.dx
                )
              );
          }

          if (edges.top) {
            top =
              Math.max(
                boundTop,
                Math.min(
                  bottom -
                    CROP_MIN_SIZE,
                  start.y +
                    gesture.dy
                )
              );
          }

          if (edges.bottom) {
            bottom =
              Math.min(
                boundBottom,
                Math.max(
                  top +
                    CROP_MIN_SIZE,
                  start.y +
                    start.height +
                    gesture.dy
                )
              );
          }

          const nextRect: CropRect = {
            x:
              left,
            y:
              top,
            width:
              right -
              left,
            height:
              bottom -
              top,
          };

          cropRectRef.current =
            nextRect;

          setCropRect(
            nextRect
          );

          const minimumScale =
            getMinimumCropScale(
              nextRect
            );

          if (
            cropScaleRef.current <
            minimumScale
          ) {
            const nextScale =
              minimumScale;

            const nextOffset =
              clampCropOffset(
                cropOffsetRef.current.x,
                cropOffsetRef.current.y,
                nextScale,
                nextRect
              );

            cropScaleRef.current =
              nextScale;

            cropOffsetRef.current =
              nextOffset;

            setCropScale(
              nextScale
            );

            setCropOffset(
              nextOffset
            );
          } else {
            const nextOffset =
              clampCropOffset(
                cropOffsetRef.current.x,
                cropOffsetRef.current.y,
                cropScaleRef.current,
                nextRect
              );

            cropOffsetRef.current =
              nextOffset;

            setCropOffset(
              nextOffset
            );
          }
        },

      onPanResponderRelease:
        () => {
          cropResizeStartRect.current =
            {
              ...cropRectRef.current,
            };
        },

      onPanResponderTerminate:
        () => {
          cropResizeStartRect.current =
            {
              ...cropRectRef.current,
            };
        },

      onPanResponderTerminationRequest:
        () => false,
    });

  const cropLeftResponder =
    useMemo(
      () =>
        makeCropResizeResponder({
          left: true,
        }),
      []
    );

  const cropRightResponder =
    useMemo(
      () =>
        makeCropResizeResponder({
          right: true,
        }),
      []
    );

  const cropTopResponder =
    useMemo(
      () =>
        makeCropResizeResponder({
          top: true,
        }),
      []
    );

  const cropBottomResponder =
    useMemo(
      () =>
        makeCropResizeResponder({
          bottom: true,
        }),
      []
    );

  const cropTopLeftResponder =
    useMemo(
      () =>
        makeCropResizeResponder({
          top: true,
          left: true,
        }),
      []
    );

  const cropTopRightResponder =
    useMemo(
      () =>
        makeCropResizeResponder({
          top: true,
          right: true,
        }),
      []
    );

  const cropBottomLeftResponder =
    useMemo(
      () =>
        makeCropResizeResponder({
          bottom: true,
          left: true,
        }),
      []
    );

  const cropBottomRightResponder =
    useMemo(
      () =>
        makeCropResizeResponder({
          bottom: true,
          right: true,
        }),
      []
    );

  const panResponder =
    useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder:
            () =>
              drawMode,
          onMoveShouldSetPanResponder:
            () =>
              drawMode,

          onPanResponderGrant:
            (
              event
            ) => {
              const {
                locationX,
                locationY,
              } =
                event.nativeEvent;

              currentPath.current =
                `M ${locationX} ${locationY}`;

              setStrokes(
                (
                  current
                ) => [
                  ...current,
                  {
                    d:
                      currentPath.current,
                    width:
                      drawWidth,
                    color:
                      drawColor,
                  },
                ]
              );
            },

          onPanResponderMove:
            (
              event
            ) => {
              const {
                locationX,
                locationY,
              } =
                event.nativeEvent;

              currentPath.current +=
                ` L ${locationX} ${locationY}`;

              setStrokes(
                (
                  current
                ) => {
                  if (
                    current.length ===
                    0
                  ) {
                    return current;
                  }

                  const next =
                    [
                      ...current,
                    ];

                  next[
                    next.length -
                      1
                  ] = {
                    ...next[
                      next.length -
                        1
                    ],
                    d:
                      currentPath.current,
                  };

                  return next;
                }
              );
            },
        }),
      [
        drawMode,
        drawWidth,
        drawColor,
      ]
    );

  const rebuildFromOriginal =
    async (
      nextRotation: number,
      ratio: number | null
    ) => {
      const normalizedRotation =
        (
          nextRotation %
          360 +
          360
        ) %
        360;

      const context =
        ImageManipulator.manipulate(
          originalUri
        );

      if (
        normalizedRotation !==
        0
      ) {
        context.rotate(
          normalizedRotation
        );
      }

      let nextWidth =
        normalizedRotation ===
          90 ||
        normalizedRotation ===
          270
          ? originalHeight
          : originalWidth;

      let nextHeight =
        normalizedRotation ===
          90 ||
        normalizedRotation ===
          270
          ? originalWidth
          : originalHeight;

      if (
        ratio !==
        null
      ) {
        const rect =
          centerCrop(
            nextWidth,
            nextHeight,
            ratio
          );

        context.crop(
          rect
        );

        nextWidth =
          rect.width;

        nextHeight =
          rect.height;
      }

      const rendered =
        await context.renderAsync();

      const result =
        await rendered.saveAsync({
          format:
            SaveFormat.JPEG,
          compress:
            0.95,
        });

      setWorkingUri(
        result.uri
      );

      setWorkingWidth(
        nextWidth
      );

      setWorkingHeight(
        nextHeight
      );

      setRotation(
        normalizedRotation
      );

      setSelectedRatio(
        ratio
      );

      setStrokes([]);
    };

  const rotate =
    async () => {
      if (busy) return;

      try {
        setBusy(true);

        const context =
          ImageManipulator.manipulate(
            workingUri
          );

        context.rotate(90);

        const rendered =
          await context.renderAsync();

        const result =
          await rendered.saveAsync({
            format: SaveFormat.JPEG,
            compress: 0.95,
          });

        setWorkingUri(result.uri);
        setWorkingWidth(workingHeight);
        setWorkingHeight(workingWidth);
        setRotation(
          (current) =>
            (current + 90) % 360
        );
        setStrokes([]);
      } finally {
        setBusy(false);
      }
    };

  const openCrop = (
    lockedRatio:
      number | null = null
  ) => {
    if (busy) return;

    setDrawMode(false);
    setCropLockedRatio(
      lockedRatio
    );

    let nextRect:
      CropRect;

    if (
      lockedRatio !==
      null
    ) {
      nextRect =
        makeFixedRatioRect(
          lockedRatio
        );
    } else {
      const padding =
        18;

      const maxWidth =
        cropStageWidth -
        padding * 2;

      const maxHeight =
        cropStageHeight -
        padding * 2;

      const sourceRatio =
        workingWidth /
        Math.max(
          workingHeight,
          1
        );

      let rectWidth =
        maxWidth;

      let rectHeight =
        rectWidth /
        Math.max(
          sourceRatio,
          0.01
        );

      if (
        rectHeight >
        maxHeight
      ) {
        rectHeight =
          maxHeight;

        rectWidth =
          rectHeight *
          sourceRatio;
      }

      nextRect = {
        x:
          (
            cropStageWidth -
            rectWidth
          ) / 2,
        y:
          (
            cropStageHeight -
            rectHeight
          ) / 2,
        width:
          Math.max(
            CROP_MIN_SIZE,
            rectWidth
          ),
        height:
          Math.max(
            CROP_MIN_SIZE,
            rectHeight
          ),
      };
    }

    const minimumScale =
      getMinimumCropScale(
        nextRect
      );

    const nextScale =
      Math.max(
        1,
        minimumScale
      );

    const nextOffset =
      clampCropOffset(
        0,
        0,
        nextScale,
        nextRect
      );

    cropRectRef.current =
      nextRect;

    cropScaleRef.current =
      nextScale;

    cropOffsetRef.current =
      nextOffset;

    cropModeRef.current =
      true;

    setCropRect(
      nextRect
    );

    setCropScale(
      nextScale
    );

    setCropOffset(
      nextOffset
    );

    setCropMode(true);
  };

  const applyCrop =
    async () => {
      if (busy) return;

      try {
        setBusy(true);

        const activeScale =
          cropScaleRef.current;

        const activeOffset =
          cropOffsetRef.current;

        const activeRect =
          cropRectRef.current;

        const displayScale =
          cropBaseScale *
          activeScale;

        const imageBounds =
          getCropImageBounds(
            activeScale,
            activeOffset
          );

        const cropWidth =
          Math.max(
            1,
            Math.min(
              workingWidth,
              Math.round(
                activeRect.width /
                  displayScale
              )
            )
          );

        const cropHeight =
          Math.max(
            1,
            Math.min(
              workingHeight,
              Math.round(
                activeRect.height /
                  displayScale
              )
            )
          );

        const originX =
          Math.max(
            0,
            Math.min(
              workingWidth -
                cropWidth,
              Math.round(
                (
                  activeRect.x -
                  imageBounds.left
                ) /
                  displayScale
              )
            )
          );

        const originY =
          Math.max(
            0,
            Math.min(
              workingHeight -
                cropHeight,
              Math.round(
                (
                  activeRect.y -
                  imageBounds.top
                ) /
                  displayScale
              )
            )
          );

        const context =
          ImageManipulator.manipulate(
            workingUri
          );

        context.crop({
          originX,
          originY,
          width:
            cropWidth,
          height:
            cropHeight,
        });

        const rendered =
          await context.renderAsync();

        const result =
          await rendered.saveAsync({
            format:
              SaveFormat.JPEG,
            compress:
              0.95,
          });

        setWorkingUri(
          result.uri
        );
        setWorkingWidth(
          cropWidth
        );
        setWorkingHeight(
          cropHeight
        );
        setSelectedRatio(
          cropLockedRatio
        );
        setStrokes([]);
        cropModeRef.current =
          false;
        setCropMode(false);
        setCropLockedRatio(
          null
        );
        setCropScale(1);
        setCropOffset({
          x: 0,
          y: 0,
        });
      } finally {
        setBusy(false);
      }
    };

  const undo =
    () => {
      setStrokes(
        (
          current
        ) =>
          current.slice(
            0,
            -1
          )
      );
    };

  const finish =
    async () => {
      if (
        busy
      ) {
        return;
      }

      try {
        setBusy(true);

        if (
          strokes.length ===
          0
        ) {
          onDone({
            uri:
              workingUri,
            width:
              workingWidth,
            height:
              workingHeight,
            mimeType:
              'image/jpeg',
          });
          return;
        }

        const capturedUri =
          await captureRef(
            canvasRef,
            {
              format:
                'jpg',
              quality:
                1,
              result:
                'tmpfile',
            }
          );

        onDone({
          uri:
            capturedUri,
          width:
            Math.round(
              canvasWidth
            ),
          height:
            Math.round(
              canvasHeight
            ),
          mimeType:
            'image/jpeg',
        });
      } finally {
        setBusy(false);
      }
    };

  if (cropMode) {
    const cropImageBounds =
      getCropImageBounds();

    return (
      <View
        style={
          styles.container
        }
      >
        <View
          style={
            styles.header
          }
        >
          <Pressable
            onPress={() => {
              cropModeRef.current =
                false;
              setCropMode(
                false
              );
              setCropLockedRatio(
                null
              );
            }}
            disabled={
              busy
            }
          >
            <Text
              style={
                styles.headerAction
              }
            >
              Cancel
            </Text>
          </Pressable>

          <Text
            style={
              styles.title
            }
          >
            Crop photo
          </Text>

          <Pressable
            onPress={
              applyCrop
            }
            disabled={
              busy
            }
          >
            <Text
              style={[
                styles.headerAction,
                styles.done,
              ]}
            >
              {busy
                ? '...'
                : 'Apply'}
            </Text>
          </Pressable>
        </View>

        <View
          style={
            styles.cropStageWrap
          }
        >
          <View
            style={[
              styles.cropStage,
              {
                width:
                  cropStageWidth,
                height:
                  cropStageHeight,
              },
            ]}
          >
            <Image
              source={{
                uri:
                  workingUri,
              }}
              style={{
                position:
                  'absolute',
                zIndex: 1,
                width:
                  cropImageBounds.width,
                height:
                  cropImageBounds.height,
                left:
                  cropImageBounds.left,
                top:
                  cropImageBounds.top,
              }}
              contentFit="fill"
            />

            <View
              pointerEvents="none"
              style={[
                styles.cropShade,
                {
                  left: 0,
                  top: 0,
                  right: 0,
                  height:
                    cropRect.y,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.cropShade,
                {
                  left: 0,
                  top:
                    cropRect.y,
                  width:
                    cropRect.x,
                  height:
                    cropRect.height,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.cropShade,
                {
                  left:
                    cropRect.x +
                    cropRect.width,
                  right: 0,
                  top:
                    cropRect.y,
                  height:
                    cropRect.height,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.cropShade,
                {
                  left: 0,
                  right: 0,
                  top:
                    cropRect.y +
                    cropRect.height,
                  bottom: 0,
                },
              ]}
            />

            <View
              pointerEvents="none"
              style={[
                styles.cropFrame,
                {
                  left:
                    cropRect.x,
                  top:
                    cropRect.y,
                  width:
                    cropRect.width,
                  height:
                    cropRect.height,
                },
              ]}
            >
              <View
                style={[
                  styles.cropGridLine,
                  styles.cropGridV1,
                ]}
              />
              <View
                style={[
                  styles.cropGridLine,
                  styles.cropGridV2,
                ]}
              />
              <View
                style={[
                  styles.cropGridLine,
                  styles.cropGridH1,
                ]}
              />
              <View
                style={[
                  styles.cropGridLine,
                  styles.cropGridH2,
                ]}
              />

              <View
                style={[
                  styles.cropCorner,
                  styles.cropCornerTopLeft,
                ]}
              />
              <View
                style={[
                  styles.cropCorner,
                  styles.cropCornerTopRight,
                ]}
              />
              <View
                style={[
                  styles.cropCorner,
                  styles.cropCornerBottomLeft,
                ]}
              />
              <View
                style={[
                  styles.cropCorner,
                  styles.cropCornerBottomRight,
                ]}
              />
            </View>

            <View
              style={[
                styles.cropImageGestureSurface,
                {
                  left:
                    cropRect.x +
                    18,
                  top:
                    cropRect.y +
                    18,
                  width:
                    Math.max(
                      0,
                      cropRect.width -
                      36
                    ),
                  height:
                    Math.max(
                      0,
                      cropRect.height -
                      36
                    ),
                },
              ]}
              {...cropPanResponder.panHandlers}
            />

            {cropLockedRatio ===
              null && (
              <>
            <View
              style={[
                styles.cropEdgeHit,
                styles.cropEdgeLeft,
                {
                  left:
                    cropRect.x -
                    14,
                  top:
                    cropRect.y +
                    24,
                  height:
                    Math.max(
                      0,
                      cropRect.height -
                      48
                    ),
                },
              ]}
              {...cropLeftResponder.panHandlers}
            />

            <View
              style={[
                styles.cropEdgeHit,
                styles.cropEdgeRight,
                {
                  left:
                    cropRect.x +
                    cropRect.width -
                    14,
                  top:
                    cropRect.y +
                    24,
                  height:
                    Math.max(
                      0,
                      cropRect.height -
                      48
                    ),
                },
              ]}
              {...cropRightResponder.panHandlers}
            />

            <View
              style={[
                styles.cropEdgeHit,
                styles.cropEdgeHorizontal,
                {
                  left:
                    cropRect.x +
                    24,
                  top:
                    cropRect.y -
                    14,
                  width:
                    Math.max(
                      0,
                      cropRect.width -
                      48
                    ),
                },
              ]}
              {...cropTopResponder.panHandlers}
            />

            <View
              style={[
                styles.cropEdgeHit,
                styles.cropEdgeHorizontal,
                {
                  left:
                    cropRect.x +
                    24,
                  top:
                    cropRect.y +
                    cropRect.height -
                    14,
                  width:
                    Math.max(
                      0,
                      cropRect.width -
                      48
                    ),
                },
              ]}
              {...cropBottomResponder.panHandlers}
            />

            <View
              style={[
                styles.cropCornerHit,
                {
                  left:
                    cropRect.x -
                    16,
                  top:
                    cropRect.y -
                    16,
                },
              ]}
              {...cropTopLeftResponder.panHandlers}
            />

            <View
              style={[
                styles.cropCornerHit,
                {
                  left:
                    cropRect.x +
                    cropRect.width -
                    16,
                  top:
                    cropRect.y -
                    16,
                },
              ]}
              {...cropTopRightResponder.panHandlers}
            />

            <View
              style={[
                styles.cropCornerHit,
                {
                  left:
                    cropRect.x -
                    16,
                  top:
                    cropRect.y +
                    cropRect.height -
                    16,
                },
              ]}
              {...cropBottomLeftResponder.panHandlers}
            />

            <View
              style={[
                styles.cropCornerHit,
                {
                  left:
                    cropRect.x +
                    cropRect.width -
                    16,
                  top:
                    cropRect.y +
                    cropRect.height -
                    16,
                },
              ]}
              {...cropBottomRightResponder.panHandlers}
            />
              </>
            )}
          </View>

          <Text
            style={
              styles.cropHint
            }
          >
            {cropLockedRatio ===
            null
              ? 'Drag any edge or corner to crop · pinch to zoom · drag inside the frame to reposition'
              : 'Pinch to zoom · drag inside the frame to choose which part of the photo stays visible'}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={
        styles.container
      }
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          onPress={
            onCancel
          }
        >
          <Text
            style={
              styles.headerAction
            }
          >
            Cancel
          </Text>
        </Pressable>

        <Text
          style={
            styles.title
          }
        >
          Edit photo
        </Text>

        <Pressable
          onPress={
            finish
          }
          disabled={
            busy
          }
        >
          <Text
            style={[
              styles.headerAction,
              styles.done,
            ]}
          >
            {busy
              ? '...'
              : 'Done'}
          </Text>
        </Pressable>
      </View>

      <View
        style={
          styles.canvasWrap
        }
      >
        <View
          ref={
            canvasRef
          }
          collapsable={
            false
          }
          style={[
            styles.canvas,
            {
              width:
                canvasWidth,
              height:
                canvasHeight,
            },
          ]}
          {...panResponder.panHandlers}
        >
          <Image
            source={{
              uri:
                workingUri,
            }}
            style={
              StyleSheet.absoluteFillObject
            }
            contentFit={
              selectedRatio ===
                null
                ? 'contain'
                : 'cover'
            }
          />

          <Svg
            pointerEvents="none"
            width="100%"
            height="100%"
            style={
              StyleSheet.absoluteFillObject
            }
          >
            {strokes.map(
              (
                stroke,
                index
              ) => (
                <SvgPath
                  key={
                    index
                  }
                  d={
                    stroke.d
                  }
                  fill="none"
                  stroke={
                    stroke.color
                  }
                  strokeWidth={
                    stroke.width
                  }
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )
            )}
          </Svg>
        </View>
      </View>

      <View
        style={
          styles.tools
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={
            styles.toolRow
          }
        >
          <Pressable
            style={[
              styles.tool,
              selectedRatio ===
                null &&
                styles.toolActive,
            ]}
            onPress={() =>
              setSelectedRatio(
                null
              )
            }
          >
            <MaterialIcons
              name="photo-size-select-large"
              size={22}
              color={
                DropColors.warmWhite
              }
            />
            <Text
              style={
                styles.toolText
              }
            >
              Original
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tool,
              selectedRatio ===
                1 &&
                styles.toolActive,
            ]}
            onPress={() =>
              openCrop(1)
            }
          >
            <MaterialIcons
              name="crop-square"
              size={22}
              color={
                DropColors.warmWhite
              }
            />
            <Text
              style={
                styles.toolText
              }
            >
              1:1
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tool,
              selectedRatio ===
                4 / 3 &&
                styles.toolActive,
            ]}
            onPress={() =>
              openCrop(
                4 / 3
              )
            }
          >
            <MaterialIcons
              name="crop"
              size={22}
              color={
                DropColors.warmWhite
              }
            />
            <Text
              style={
                styles.toolText
              }
            >
              4:3
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tool,
              selectedRatio ===
                16 / 9 &&
                styles.toolActive,
            ]}
            onPress={() =>
              openCrop(
                16 / 9
              )
            }
          >
            <MaterialIcons
              name="crop-16-9"
              size={22}
              color={
                DropColors.warmWhite
              }
            />
            <Text
              style={
                styles.toolText
              }
            >
              16:9
            </Text>
          </Pressable>

          <Pressable
            style={
              styles.tool
            }
            onPress={() =>
              openCrop()
            }
            disabled={
              busy
            }
          >
            <MaterialIcons
              name="crop"
              size={22}
              color={
                DropColors.warmWhite
              }
            />
            <Text
              style={
                styles.toolText
              }
            >
              Crop
            </Text>
          </Pressable>

          <Pressable
            style={
              styles.tool
            }
            onPress={
              rotate
            }
          >
            <MaterialIcons
              name="rotate-right"
              size={22}
              color={
                DropColors.warmWhite
              }
            />
            <Text
              style={
                styles.toolText
              }
            >
              Rotate
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tool,
              drawMode &&
                styles.toolActive,
            ]}
            onPress={() =>
              setDrawMode(
                (
                  value
                ) =>
                  !value
              )
            }
          >
            <MaterialIcons
              name="draw"
              size={22}
              color={
                DropColors.warmWhite
              }
            />
            <Text
              style={
                styles.toolText
              }
            >
              Draw
            </Text>
          </Pressable>

          <Pressable
            style={
              styles.tool
            }
            onPress={
              undo
            }
          >
            <MaterialIcons
              name="undo"
              size={22}
              color={
                DropColors.warmWhite
              }
            />
            <Text
              style={
                styles.toolText
              }
            >
              Undo
            </Text>
          </Pressable>
        </ScrollView>

        {drawMode && (
          <View
            style={
              styles.drawOptions
            }
          >
            <View
              style={
                styles.colors
              }
            >
              {[
                DropColors.warmWhite,
                DropColors.wine,
                '#000000',
              ].map(
                (
                  color
                ) => (
                  <Pressable
                    key={
                      color
                    }
                    onPress={() =>
                      setDrawColor(
                        color
                      )
                    }
                    style={[
                      styles.colorDot,
                      {
                        backgroundColor:
                          color,
                      },
                      drawColor ===
                        color &&
                        styles.colorDotActive,
                    ]}
                  />
                )
              )}
            </View>

            <View
              style={
                styles.widths
              }
            >
              {[
                3,
                6,
                10,
              ].map(
                (
                  value
                ) => (
                  <Pressable
                    key={
                      value
                    }
                    onPress={() =>
                      setDrawWidth(
                        value
                      )
                    }
                    style={[
                      styles.widthButton,
                      drawWidth ===
                        value &&
                        styles.widthButtonActive,
                    ]}
                  >
                    <Text
                      style={
                        styles.widthText
                      }
                    >
                      {value}
                    </Text>
                  </Pressable>
                )
              )}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        DropColors.graphite,
    },

    header: {
      paddingTop:
        56,
      paddingHorizontal:
        18,
      paddingBottom:
        14,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
      borderBottomWidth:
        StyleSheet.hairlineWidth,
      borderBottomColor:
        DropColors.border,
    },

    title: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize:
        16,
    },

    headerAction: {
      color:
        DropColors.textSecondary,
      fontFamily:
        DropTypography.medium,
      fontSize:
        14,
      minWidth:
        52,
    },

    done: {
      color:
        DropColors.warmWhite,
      textAlign:
        'right',
    },

    canvasWrap: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingVertical:
        16,
    },

    canvas: {
      backgroundColor:
        '#000',
      overflow:
        'hidden',
    },

    tools: {
      paddingHorizontal:
        12,
      paddingTop:
        12,
      paddingBottom:
        28,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        DropColors.border,
    },

    toolRow: {
      flexDirection:
        'row',
      alignItems:
        'center',
      gap: 6,
      paddingRight: 12,
    },

    tool: {
      minWidth:
        48,
      minHeight:
        48,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderRadius:
        12,
    },

    toolActive: {
      backgroundColor:
        DropColors.surface,
    },

    toolDisabled: {
      opacity: 0.45,
    },

    toolText: {
      marginTop:
        3,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize:
        9,
    },

    drawOptions: {
      marginTop:
        12,
      paddingTop:
        12,
      borderTopWidth:
        StyleSheet.hairlineWidth,
      borderTopColor:
        DropColors.border,
      flexDirection:
        'row',
      alignItems:
        'center',
      justifyContent:
        'space-between',
    },

    cropStageWrap: {
      flex: 1,
      alignItems:
        'center',
      justifyContent:
        'center',
      paddingHorizontal:
        12,
      paddingVertical:
        18,
    },

    cropStage: {
      position:
        'relative',
      backgroundColor:
        '#000',
      overflow:
        'hidden',
    },

    cropShade: {
      position:
        'absolute',
      zIndex: 2,
      backgroundColor:
        'rgba(0,0,0,0.58)',
    },

    cropFrame: {
      position:
        'absolute',
      zIndex: 5,
      borderWidth:
        1,
      borderColor:
        'rgba(255,255,255,0.95)',
    },

    cropGridLine: {
      position:
        'absolute',
      backgroundColor:
        'rgba(255,255,255,0.32)',
    },

    cropGridV1: {
      top: 0,
      bottom: 0,
      left:
        '33.333%',
      width:
        StyleSheet.hairlineWidth,
    },

    cropGridV2: {
      top: 0,
      bottom: 0,
      left:
        '66.666%',
      width:
        StyleSheet.hairlineWidth,
    },

    cropGridH1: {
      left: 0,
      right: 0,
      top:
        '33.333%',
      height:
        StyleSheet.hairlineWidth,
    },

    cropGridH2: {
      left: 0,
      right: 0,
      top:
        '66.666%',
      height:
        StyleSheet.hairlineWidth,
    },

    cropCorner: {
      position:
        'absolute',
      width: 18,
      height: 18,
      borderColor:
        DropColors.warmWhite,
    },

    cropCornerTopLeft: {
      left: -2,
      top: -2,
      borderLeftWidth:
        3,
      borderTopWidth:
        3,
    },

    cropCornerTopRight: {
      right: -2,
      top: -2,
      borderRightWidth:
        3,
      borderTopWidth:
        3,
    },

    cropCornerBottomLeft: {
      left: -2,
      bottom: -2,
      borderLeftWidth:
        3,
      borderBottomWidth:
        3,
    },

    cropCornerBottomRight: {
      right: -2,
      bottom: -2,
      borderRightWidth:
        3,
      borderBottomWidth:
        3,
    },

    cropImageGestureSurface: {
      position:
        'absolute',
      zIndex: 10,
      backgroundColor:
        'transparent',
    },

    cropEdgeHit: {
      position:
        'absolute',
      width: 28,
      zIndex: 20,
    },

    cropEdgeLeft: {
      width: 28,
    },

    cropEdgeRight: {
      width: 28,
    },

    cropEdgeHorizontal: {
      height: 28,
    },

    cropCornerHit: {
      position:
        'absolute',
      width: 32,
      height: 32,
      zIndex: 30,
    },

    cropHint: {
      marginTop:
        14,
      color:
        DropColors.textMuted,
      fontFamily:
        DropTypography.regular,
      fontSize:
        12,
      textAlign:
        'center',
    },

    colors: {
      flexDirection:
        'row',
      gap:
        12,
    },

    colorDot: {
      width:
        26,
      height:
        26,
      borderRadius:
        13,
      borderWidth:
        1,
      borderColor:
        DropColors.border,
    },

    colorDotActive: {
      borderWidth:
        2,
      borderColor:
        DropColors.warmWhite,
    },

    widths: {
      flexDirection:
        'row',
      gap:
        8,
    },

    widthButton: {
      width:
        34,
      height:
        30,
      borderRadius:
        9,
      alignItems:
        'center',
      justifyContent:
        'center',
      borderWidth:
        StyleSheet.hairlineWidth,
      borderColor:
        DropColors.border,
    },

    widthButtonActive: {
      backgroundColor:
        DropColors.surface,
    },

    widthText: {
      color:
        DropColors.warmWhite,
      fontFamily:
        DropTypography.medium,
      fontSize:
        11,
    },
  });