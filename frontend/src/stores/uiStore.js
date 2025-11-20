import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useUIStore = create(
  persist(
    (set, get) => ({
      // State
      sidebarOpen: true,
      theme: 'light',
      activeSection: 'dashboard',
      notifications: [],
      modalOpen: false,
      modalContent: null,

      // Actions
      toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen })),

      setTheme: (theme) => {
        set({ theme });
        document.documentElement.setAttribute('data-theme', theme);
      },

      toggleTheme: () => {
        const newTheme = get().theme === 'light' ? 'dark' : 'light';
        get().setTheme(newTheme);
      },

      isDarkMode: () => get().theme === 'dark',

      addNotification: (message, type = 'info') => {
        const id = Date.now();
        set(state => ({
          notifications: [...state.notifications, { id, message, type }],
        }));
        setTimeout(() => {
          get().removeNotification(id);
        }, 5000);
      },

      removeNotification: (id) =>
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== id),
        })),

      clearNotifications: () => set({ notifications: [] }),

      navigateTo: (section) => set({ activeSection: section }),

      isActive: (section) => get().activeSection === section,

      openModal: (content) => set({ modalContent: content, modalOpen: true }),

      closeModal: () => set({ modalOpen: false, modalContent: null }),
    }),
    {
      name: 'ui-storage',
      partialize: (state) => ({
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        activeSection: state.activeSection,
      }),
    }
  )
);

export default useUIStore;
