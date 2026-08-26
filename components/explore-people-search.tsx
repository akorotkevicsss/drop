import { router } from 'expo-router';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { UserAvatar } from '@/components/user-avatar';
import {
  DropColors,
  DropTypography,
} from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type UserResult = {
 id: string;
 username: string | null;
 display_name: string | null;
 avatar_url: string | null;
 city: string | null;
};

export function ExplorePeopleSearch() {
 const [query, setQuery] =
   useState('');

 const [users, setUsers] =
   useState<UserResult[]>([]);

 const [loading, setLoading] =
   useState(true);

 useEffect(() => {
   let mounted = true;

   const loadUsers = async () => {
     try {
       setLoading(true);

       const {
         data: { user },
         error: userError,
       } =
         await supabase.auth.getUser();

       if (
         userError ||
         !user
       ) {
         return;
       }

       const {
         data,
         error,
       } =
         await supabase
           .from('profiles')
           .select(`
             id,
             username,
             display_name,
             avatar_url,
             city
           `)
           .neq(
             'id',
             user.id
           )
           .order(
             'display_name',
             {
               ascending: true,
             }
           )
           .limit(100);

       if (error) {
         console.error(
           'EXPLORE PEOPLE SEARCH ERROR:',
           error
         );

         return;
       }

       if (mounted) {
         setUsers(
           (data ?? []) as UserResult[]
         );
       }
     } finally {
       if (mounted) {
         setLoading(false);
       }
     }
   };

     loadUsers();

    return () => {
      mounted = false;
    };
  }, []);

  const results =
    useMemo(() => {
      const normalized =
        query
          .trim()
          .toLowerCase()
          .replace(/^@/, '');

      if (!normalized) {
        return [];
      }

      return users.filter(
        (user) => {
          const username =
            (
              user.username ??
              ''
            ).toLowerCase();

          const displayName =
            (
              user.display_name ??
              ''
            ).toLowerCase();

          const city =
            (
              user.city ??
              ''
            ).toLowerCase();

          return (
            username.includes(
              normalized
            ) ||
            displayName.includes(
              normalized
            ) ||
            city.includes(
              normalized
            )
          );
        }
      );
    }, [
      query,
      users,
    ]);

  return (
    <TouchableWithoutFeedback
      onPress={Keyboard.dismiss}
      accessible={false}
    >
      <View style={styles.container}>
        <View style={styles.searchRow}>
          <Text style={styles.searchIcon}>
            ⌕
          </Text>

          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search people"
            placeholderTextColor={
              DropColors.textMuted
            }
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            selectionColor={
              DropColors.wine
            }
          />

          {!!query && (
            <Pressable
              onPress={() =>
                setQuery('')
              }
              hitSlop={10}
            >
              <Text style={styles.clear}>
                ×
              </Text>
            </Pressable>
          )}
        </View>

        {loading ? (
          <View
            style={
              styles.stateContainer
            }
          >
            <ActivityIndicator
              color={
                DropColors.warmWhite
              }
            />
          </View>
        ) : !query.trim() ? (
          <View
            style={
              styles.stateContainer
            }
          >
            <Text
              style={
                styles.stateTitle
              }
            >
              Find people
            </Text>

            <Text
              style={
                styles.stateSubtitle
              }
            >
              Search by name, @username or city.
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View
            style={
              styles.stateContainer
            }
          >
            <Text
              style={
                styles.stateTitle
              }
            >
              No people found
            </Text>

            <Text
              style={
                styles.stateSubtitle
              }
            >
              Try another name or username.
            </Text>
          </View>
        ) : (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.resultsContent
            }
          >
            {results.map(
              (user) => {
                const name =
                  user.display_name ||
                  user.username ||
                  'Unnamed user';

                return (
                  <Pressable
                    key={user.id}
                    style={({
                      pressed,
                    }) => [
                      styles.userRow,
                      pressed &&
                        styles.userRowPressed,
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();

                      if (
                        !user.username
                      ) {
                        return;
                      }

                      router.push(
                        `/user/${user.username}`
                      );
                    }}
                  >
                    <UserAvatar
                      uri={
                        user.avatar_url
                      }
                      name={name}
                      size={46}
                    />

                    <View
                      style={
                        styles.userText
                      }
                    >
                      <Text
                        style={
                          styles.name
                        }
                      >
                        {name}
                      </Text>

                      <View
                        style={
                          styles.metaRow
                        }
                      >
                        {!!user.username && (
                          <Text
                            style={
                              styles.username
                            }
                          >
                            @{user.username}
                          </Text>
                        )}

                        {!!user.city && (
                          <>
                            <Text
                              style={
                                styles.metaDot
                              }
                            >
                              ·
                            </Text>

                            <Text
                              style={
                                styles.city
                              }
                            >
                              {user.city}
                            </Text>
                          </>
                        )}
                      </View>
                    </View>

                    <Text
                      style={
                        styles.chevron
                      }
                    >
                      ›
                    </Text>
                  </Pressable>
                );
              }
            )}
          </ScrollView>
        )}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles =
 StyleSheet.create({
   container: {
     flex: 1,
     backgroundColor:
       DropColors.graphite,
   },

   searchRow: {
     marginHorizontal: 18,
     marginTop: 18,
     minHeight: 52,
     flexDirection: 'row',
     alignItems: 'center',
     borderBottomWidth:
       StyleSheet.hairlineWidth,
     borderBottomColor:
       DropColors.border,
   },

   searchIcon: {
     color:
       DropColors.textSecondary,
     fontSize: 22,
     marginRight: 10,
     marginBottom: 2,
   },

   input: {
     flex: 1,
     color:
       DropColors.warmWhite,
     fontFamily:
       DropTypography.regular,
     fontSize: 17,
     paddingVertical: 13,
   },

   clear: {
     color:
       DropColors.textSecondary,
     fontSize: 25,
     fontWeight: '300',
     paddingLeft: 10,
   },

   stateContainer: {
     flex: 1,
     minHeight: 360,
     alignItems: 'center',
     justifyContent: 'center',
     paddingHorizontal: 36,
   },

   stateTitle: {
     color:
       DropColors.warmWhite,
     fontFamily:
       DropTypography.medium,
     fontSize: 17,
     textAlign: 'center',
   },

   stateSubtitle: {
     color:
       DropColors.textSecondary,
     fontFamily:
       DropTypography.regular,
     fontSize: 13,
     lineHeight: 19,
     textAlign: 'center',
     marginTop: 7,
   },

   resultsContent: {
     paddingTop: 8,
     paddingBottom: 24,
   },

   userRow: {
     minHeight: 72,
     paddingHorizontal: 18,
     flexDirection: 'row',
     alignItems: 'center',
     borderBottomWidth:
       StyleSheet.hairlineWidth,
     borderBottomColor:
       DropColors.border,
   },

   userRowPressed: {
     opacity: 0.62,
   },

   userText: {
     flex: 1,
     marginLeft: 13,
   },

   name: {
     color:
       DropColors.warmWhite,
     fontFamily:
       DropTypography.medium,
     fontSize: 15,
   },

   metaRow: {
     flexDirection: 'row',
     alignItems: 'center',
     marginTop: 3,
   },

   username: {
     color:
       DropColors.textSecondary,
     fontFamily:
       DropTypography.regular,
     fontSize: 13,
   },

   metaDot: {
     color:
       DropColors.textMuted,
     fontSize: 13,
     marginHorizontal: 6,
   },

   city: {
     color:
       DropColors.textMuted,
     fontFamily:
       DropTypography.regular,
     fontSize: 13,
   },

   chevron: {
     color:
       DropColors.textMuted,
     fontSize: 28,
     fontWeight: '200',
     marginLeft: 12,
   },
 });