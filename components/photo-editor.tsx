import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import {
  ImageManipulator,
  SaveFormat,
} from 'expo-image-manipulator';
import { useMemo, useRef, useState } from 'react';
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
    cropScale,
    setCropScale,
  ] = useState(1);

  const [
    cropOffset,
    setCropOffset,
  ] = useState({ x: 0, y: 0 });

  const cropStartOffset =
    useRef({ x: 0, y: 0 });

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

  const cropTargetRatio =
    selectedRatio ??
    workingWidth / Math.max(workingHeight, 1);

  const cropMaxWidth = SCREEN_WIDTH - 24;
  const cropMaxHeight = 520;

  const cropViewport = (() => {
    if (cropMaxWidth / cropMaxHeight > cropTargetRatio) {
      return {
        width: cropMaxHeight * cropTargetRatio,
        height: cropMaxHeight,
      };
    }

    return {
      width: cropMaxWidth,
      height: cropMaxWidth / Math.max(cropTargetRatio, 0.01),
    };
  })();

  const cropBaseScale = Math.max(
    cropViewport.width / Math.max(workingWidth, 1),
    cropViewport.height / Math.max(workingHeight, 1)
  );

  const cropDisplayWidth =
    workingWidth * cropBaseScale * cropScale;
  const cropDisplayHeight =
    workingHeight * cropBaseScale * cropScale;

  const clampCropOffset = (x: number, y: number) => {
    const maxX = Math.max(0, (cropDisplayWidth - cropViewport.width) / 2);
    const maxY = Math.max(0, (cropDisplayHeight - cropViewport.height) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const cropPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => cropMode,
        onMoveShouldSetPanResponder: () => cropMode,
        onPanResponderGrant: () => {
          cropStartOffset.current = cropOffset;
        },
        onPanResponderMove: (_, gesture) => {
          if (!cropMode) return;

          setCropOffset(
            clampCropOffset(
              cropStartOffset.current.x + gesture.dx,
              cropStartOffset.current.y + gesture.dy
            )
          );
        },
      }),
    [
      cropMode,
      cropOffset,
      cropDisplayWidth,
      cropDisplayHeight,
      cropViewport.width,
      cropViewport.height,
    ]
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

  const openCrop = () => {
    if (busy) return;

    setDrawMode(false);
    setCropScale(1);
    setCropOffset({ x: 0, y: 0 });
    setCropMode(true);
  };

  const changeCropScale = (nextScale: number) => {
    const normalizedScale = Math.max(1, Math.min(4, nextScale));
    setCropScale(normalizedScale);
    setCropOffset({ x: 0, y: 0 });
  };

  const applyCrop =
    async () => {
      if (busy) return;

      try {
        setBusy(true);

        const displayScale =
          cropBaseScale * cropScale;

        const imageLeft =
          (cropViewport.width - cropDisplayWidth) / 2 +
          cropOffset.x;
        const imageTop =
          (cropViewport.height - cropDisplayHeight) / 2 +
          cropOffset.y;

        const cropWidth = Math.min(
          workingWidth,
          Math.round(cropViewport.width / displayScale)
        );
        const cropHeight = Math.min(
          workingHeight,
          Math.round(cropViewport.height / displayScale)
        );

        const originX = Math.max(
          0,
          Math.min(
            workingWidth - cropWidth,
            Math.round(-imageLeft / displayScale)
          )
        );
        const originY = Math.max(
          0,
          Math.min(
            workingHeight - cropHeight,
            Math.round(-imageTop / displayScale)
          )
        );

        const context =
          ImageManipulator.manipulate(
            workingUri
          );

        context.crop({
          originX,
          originY,
          width: cropWidth,
          height: cropHeight,
        });

        const rendered =
          await context.renderAsync();

        const result =
          await rendered.saveAsync({
            format: SaveFormat.JPEG,
            compress: 0.95,
          });

        setWorkingUri(result.uri);
        setWorkingWidth(cropWidth);
        setWorkingHeight(cropHeight);
        setStrokes([]);
        setCropMode(false);
        setCropScale(1);
        setCropOffset({ x: 0, y: 0 });
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
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            onPress={() => setCropMode(false)}
            disabled={busy}
          >
            <Text style={styles.headerAction}>Cancel</Text>
          </Pressable>

          <Text style={styles.title}>Crop photo</Text>

          <Pressable
            onPress={applyCrop}
            disabled={busy}
          >
            <Text style={[styles.headerAction, styles.done]}>
              {busy ? '...' : 'Apply'}
            </Text>
          </Pressable>
        </View>

        <View style={styles.cropStage}>
          <View
            style={[
              styles.cropViewport,
              {
                width: cropViewport.width,
                height: cropViewport.height,
              },
            ]}
            {...cropPanResponder.panHandlers}
          >
            <Image
              source={{ uri: workingUri }}
              style={{
                position: 'absolute',
                width: cropDisplayWidth,
                height: cropDisplayHeight,
                left:
                  (cropViewport.width - cropDisplayWidth) / 2 +
                  cropOffset.x,
                top:
                  (cropViewport.height - cropDisplayHeight) / 2 +
                  cropOffset.y,
              }}
              contentFit="fill"
            />

            <View pointerEvents="none" style={styles.cropGrid}>
              <View style={[styles.cropGridLine, styles.cropGridV1]} />
              <View style={[styles.cropGridLine, styles.cropGridV2]} />
              <View style={[styles.cropGridLine, styles.cropGridH1]} />
              <View style={[styles.cropGridLine, styles.cropGridH2]} />
            </View>
          </View>

          <Text style={styles.cropHint}>Drag to reposition · use − / + to zoom</Text>
        </View>

        <View style={styles.cropControls}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cropRatioRow}
          >
            {[
              { label: 'Original', value: null as number | null },
              { label: '1:1', value: 1 },
              { label: '4:3', value: 4 / 3 },
              { label: '16:9', value: 16 / 9 },
            ].map((item) => {
              const active =
                item.value === null
                  ? selectedRatio === null
                  : selectedRatio === item.value;

              return (
                <Pressable
                  key={item.label}
                  style={[styles.cropRatioButton, active && styles.toolActive]}
                  onPress={() => {
                    setSelectedRatio(item.value);
                    setCropScale(1);
                    setCropOffset({ x: 0, y: 0 });
                  }}
                >
                  <Text style={styles.cropRatioText}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.cropZoomRow}>
            <Pressable
              style={styles.cropZoomButton}
              onPress={() => changeCropScale(cropScale - 0.15)}
            >
              <MaterialIcons name="remove" size={24} color={DropColors.warmWhite} />
            </Pressable>

            <Text style={styles.cropZoomText}>
              {Math.round(cropScale * 100)}%
            </Text>

            <Pressable
              style={styles.cropZoomButton}
              onPress={() => changeCropScale(cropScale + 0.15)}
            >
              <MaterialIcons name="add" size={24} color={DropColors.warmWhite} />
            </Pressable>
          </View>
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
              setSelectedRatio(1)
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
              setSelectedRatio(
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
              setSelectedRatio(
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
            onPress={
              openCrop
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

    cropStage: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingVertical: 18,
    },

    cropViewport: {
      backgroundColor: '#000',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: DropColors.warmWhite,
    },

    cropGrid: {
      ...StyleSheet.absoluteFillObject,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.8)',
    },

    cropGridLine: {
      position: 'absolute',
      backgroundColor: 'rgba(255,255,255,0.35)',
    },

    cropGridV1: {
      top: 0,
      bottom: 0,
      left: '33.333%',
      width: StyleSheet.hairlineWidth,
    },

    cropGridV2: {
      top: 0,
      bottom: 0,
      left: '66.666%',
      width: StyleSheet.hairlineWidth,
    },

    cropGridH1: {
      left: 0,
      right: 0,
      top: '33.333%',
      height: StyleSheet.hairlineWidth,
    },

    cropGridH2: {
      left: 0,
      right: 0,
      top: '66.666%',
      height: StyleSheet.hairlineWidth,
    },

    cropHint: {
      marginTop: 14,
      color: DropColors.textMuted,
      fontFamily: DropTypography.regular,
      fontSize: 12,
      textAlign: 'center',
    },

    cropControls: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: DropColors.border,
      paddingTop: 12,
      paddingBottom: 28,
    },

    cropRatioRow: {
      paddingHorizontal: 12,
      gap: 8,
      alignItems: 'center',
    },

    cropRatioButton: {
      minWidth: 72,
      height: 38,
      paddingHorizontal: 14,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },

    cropRatioText: {
      color: DropColors.warmWhite,
      fontFamily: DropTypography.medium,
      fontSize: 12,
    },

    cropZoomRow: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 18,
    },

    cropZoomButton: {
      width: 42,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DropColors.surface,
    },

    cropZoomText: {
      minWidth: 52,
      textAlign: 'center',
      color: DropColors.warmWhite,
      fontFamily: DropTypography.medium,
      fontSize: 12,
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