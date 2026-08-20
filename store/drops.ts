import { create } from 'zustand';

export type JoinStatus = 'none' | 'requested' | 'accepted';
export type RequestStatus = 'pending' | 'accepted';

export type JoinRequest = {
  id: number;
  name: string;
  username: string;
  status: RequestStatus;
};

export type Drop = {
  id: number;
  name: string;
  username: string;
  time: string;
  text: string;
  meta: string;
  joinStatus: JoinStatus;
  requests: JoinRequest[];
};

type DropStore = {
  drops: Drop[];

  addDrop: (drop: Drop) => void;

  requestJoin: (id: number) => void;

  cancelJoinRequest: (id: number) => void;

  acceptRequest: (
    dropId: number,
    requestId: number
  ) => void;

  declineRequest: (
    dropId: number,
    requestId: number
  ) => void;
};

export const useDropStore = create<DropStore>((set) => ({
  drops: [
    {
      id: 1,
      name: 'Laura',
      username: '@laura',
      time: '4m',
      text: 'Coffee in the centre after work?',
      meta: 'Riga · Today, 18:30',
      joinStatus: 'none',
      requests: [],
    },

    {
      id: 2,
      name: 'Martins',
      username: '@martins',
      time: '18m',
      text: 'Need +2 for football tonight.',
      meta: 'Āgenskalns · 20:00',
      joinStatus: 'none',
      requests: [],
    },

    {
      id: 3,
      name: 'Anna',
      username: '@anna',
      time: '32m',
      text: 'Anyone wants to just drive around tonight?',
      meta: 'Riga · Tonight',
      joinStatus: 'none',
      requests: [],
    },
  ],

  addDrop: (drop) =>
    set((state) => ({
      drops: [drop, ...state.drops],
    })),

  requestJoin: (id) =>
    set((state) => ({
      drops: state.drops.map((drop) =>
        drop.id === id
          ? {
              ...drop,
              joinStatus: 'requested',
            }
          : drop
      ),
    })),

  cancelJoinRequest: (id) =>
    set((state) => ({
      drops: state.drops.map((drop) =>
        drop.id === id
          ? {
              ...drop,
              joinStatus: 'none',
            }
          : drop
      ),
    })),

  acceptRequest: (dropId, requestId) =>
    set((state) => ({
      drops: state.drops.map((drop) =>
        drop.id === dropId
          ? {
              ...drop,
              requests: drop.requests.map((request) =>
                request.id === requestId
                  ? {
                      ...request,
                      status: 'accepted',
                    }
                  : request
              ),
            }
          : drop
      ),
    })),

  declineRequest: (dropId, requestId) =>
    set((state) => ({
      drops: state.drops.map((drop) =>
        drop.id === dropId
          ? {
              ...drop,
              requests: drop.requests.filter(
                (request) => request.id !== requestId
              ),
            }
          : drop
      ),
    })),
}));