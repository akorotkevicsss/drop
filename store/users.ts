import { create } from 'zustand';

export type User = {
  id: number;
  name: string;
  username: string;
  bio: string;
  city: string;
  followers: number;
  following: number;
  isFollowing: boolean;
};

type UserStore = {
  users: User[];
  currentUser: User;
  toggleFollow: (userId: number) => void;
};

export const useUserStore = create<UserStore>((set) => ({
  currentUser: {
    id: 100,
    name: 'You',
    username: '@you',
    bio: 'Trying to make things happen.',
    city: 'Riga',
    followers: 24,
    following: 18,
    isFollowing: false,
  },

  users: [
    {
      id: 1,
      name: 'Laura',
      username: '@laura',
      bio: 'Coffee, music and spontaneous plans.',
      city: 'Riga',
      followers: 312,
      following: 184,
      isFollowing: true,
    },
    {
      id: 2,
      name: 'Martins',
      username: '@martins',
      bio: 'Football. Friends. Riga.',
      city: 'Riga',
      followers: 146,
      following: 201,
      isFollowing: false,
    },
    {
      id: 3,
      name: 'Anna',
      username: '@anna',
      bio: 'Usually somewhere around Riga.',
      city: 'Riga',
      followers: 428,
      following: 267,
      isFollowing: false,
    },
  ],

  toggleFollow: (userId) =>
    set((state) => ({
      users: state.users.map((user) => {
        if (user.id !== userId) {
          return user;
        }

        const nextFollowing = !user.isFollowing;

        return {
          ...user,
          isFollowing: nextFollowing,
          followers: nextFollowing
            ? user.followers + 1
            : user.followers - 1,
        };
      }),
    })),
}));