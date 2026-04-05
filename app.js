
const firebaseConfig = {
    apiKey: "YOUR_API_KEY_HERE",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
let auth;
let userId = 'default';

try {
    if (firebaseConfig.apiKey !== "YOUR_API_KEY_HERE") {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
    } else {
        console.warn('⚠️ Firebase not configured - using demo mode with localStorage only');
        console.warn('📝 See CLAUDE.md for setup instructions');
    }
} catch (e) {
    console.warn('Firebase initialization failed:', e);
}

// Todo App JavaScript
class TodoApp {
    constructor() {
        this.userId = 'default';
        this.tasks = [];
        this.currentFilter = 'all';
        this.searchQuery = '';
        this.authInitialized = false;
        this.profile = {};
    }

    async init() {
        // Initialize auth first
        await this.initAuth();

        // Load user tasks
        this.loadTasks();

        // Bind events
        this.bindEvents();

        // Initial render
        this.updateDate();
        this.render();
        this.updateStats();

        console.log('✅ Todo App initialized');
    }

    async initAuth() {
        if (!auth) {
            // Demo mode - no Firebase
            this.userId = 'default';
            this.showAuthModal();
            return;
        }

        // Check initial auth state
        try {
            const user = await auth.getRedirectResult();
            this.handleAuthStateChange(user.user);
        } catch (error) {
            console.log('No redirect result, checking current user');
            this.handleAuthStateChange(auth.currentUser);
        }

        // Set up auth state listener
        auth.onAuthStateChanged((user) => {
            console.log('Auth state changed:', user ? `User: ${user.displayName}` : 'Signed out');
            this.handleAuthStateChange(user);
        });

        this.authInitialized = true;
    }

    handleAuthStateChange(user) {
        if (user) {
            this.userId = user.uid;
            console.log(`✅ Signed in as: ${user.displayName} (${user.email})`);
            this.hideAuthModal();
            this.loadTasks();
            this.updateUserDisplay(user);
            this.showUserMenu();
            this.render();
            this.updateStats();
        } else {
            this.userId = 'default';
            console.log('👤 User signed out');
            this.showAuthModal();
            this.hideUserMenu();
        }
    }

    updateUserDisplay(user = null) {
        // Merge profile data: profile overrides Firebase user data
        const displayName = this.profile.displayName || (user?.displayName) || 'User';
        const avatar = this.profile.avatar || (user?.photoURL) || '';
        const email = user?.email || 'Demo User';

        // Build avatar HTML: use custom avatar if available, else initials generator
        const avatarHtml = avatar
            ? `<img src="${avatar}" alt="Avatar">`
            : `<i class="fas fa-user"></i>`;

        document.getElementById('userAvatar').innerHTML = avatarHtml;
        document.getElementById('userAvatarLarge').innerHTML = avatarHtml;
        document.getElementById('userName').textContent = displayName;
        document.getElementById('userEmail').textContent = email;
    }

    showAuthModal() {
        document.getElementById('authModal').classList.remove('hidden');
    }

    hideAuthModal() {
        document.getElementById('authModal').classList.add('hidden');
    }

    showProfileModal() {
        // Populate form with current profile data
        document.getElementById('profileNameInput').value = this.profile.displayName || '';
        const avatarPreview = document.getElementById('profileAvatarPreview');
        if (this.profile.avatar) {
            avatarPreview.innerHTML = `<img src="${this.profile.avatar}" alt="Avatar Preview">`;
        } else {
            avatarPreview.innerHTML = `<i class="fas fa-user"></i>`;
        }
        document.getElementById('avatarUrlInput').value = '';
        document.getElementById('avatarFileInput').value = '';
        document.getElementById('profileModal').classList.remove('hidden');
    }

    hideProfileModal() {
        document.getElementById('profileModal').classList.add('hidden');
    }

    showUserMenu() {
        document.getElementById('userMenu').style.display = 'block';
        document.getElementById('authButton').style.display = 'none';
    }

    hideUserMenu() {
        document.getElementById('userMenu').style.display = 'none';
        document.getElementById('authButton').style.display = 'flex';
    }

    bindEvents() {
        // Add task
        document.getElementById('addTaskBtn').addEventListener('click', () => this.addTask());
        document.getElementById('taskInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.addTask();
        });

        // Filter tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.render();
            });
        });

        // Search
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.searchQuery = e.target.value.toLowerCase();
            this.render();
        });

        // Clear completed
        document.getElementById('clearCompletedBtn').addEventListener('click', () => this.clearCompleted());

        // Auth - Show modal on button click
        document.getElementById('authButton').addEventListener('click', () => {
            this.showAuthModal();
        });

        // Auth - Google Sign In
        document.getElementById('googleSignIn').addEventListener('click', () => {
            if (auth) {
                const provider = new firebase.auth.GoogleAuthProvider();
                auth.signInWithPopup(provider).catch(console.error);
            } else {
                this.showAuthWarning();
            }
        });

        // Auth - GitHub Sign In
        document.getElementById('githubSignIn').addEventListener('click', () => {
            if (auth) {
                const provider = new firebase.auth.GithubAuthProvider();
                auth.signInWithPopup(provider).catch(console.error);
            } else {
                this.showAuthWarning();
            }
        });

        // Auth - Facebook Sign In
        document.getElementById('facebookSignIn').addEventListener('click', () => {
            if (auth) {
                const provider = new firebase.auth.FacebookAuthProvider();
                auth.signInWithPopup(provider).catch(console.error);
            } else {
                this.showAuthWarning();
            }
        });

        // Sign Out
        document.getElementById('signOutBtn').addEventListener('click', () => {
            if (auth) {
                auth.signOut();
            } else {
                // Demo mode - just reset to default user
                this.handleAuthStateChange(null);
            }
        });

        // Close modal on overlay click
        document.getElementById('authModal').addEventListener('click', (e) => {
            if (e.target.id === 'authModal') {
                this.hideAuthModal();
            }
        });
    }

    showAuthWarning() {
        alert('Firebase is not configured. Please set up Firebase Authentication first.\n\nSee CLAUDE.md for instructions.');
    }

    getStorageKey() {
        return `todos_${this.userId}`;
    }

    getProfileStorageKey() {
        return `profile_${this.userId}`;
    }

    loadProfile() {
        try {
            const stored = localStorage.getItem(this.getProfileStorageKey());
            if (stored) {
                this.profile = JSON.parse(stored);
            } else {
                this.profile = this.getDefaultProfile();
            }
        } catch (e) {
            console.error('Error loading profile:', e);
            this.profile = this.getDefaultProfile();
        }
        return this.profile;
    }

    saveProfile() {
        try {
            localStorage.setItem(this.getProfileStorageKey(), JSON.stringify(this.profile));
        } catch (e) {
            console.error('Error saving profile:', e);
            alert('Failed to save profile. Local storage may be full or disabled.');
        }
    }

    getDefaultProfile() {
        return {
            displayName: 'Demo User',
            avatar: ''
        };
    }

    getMergedProfile(user = null) {
        // Profile data always overrides Firebase data
        return {
            displayName: this.profile.displayName || (user?.displayName) || 'User',
            avatar: this.profile.avatar || (user?.photoURL) || '',
            email: user?.email || 'Demo User'
        };
    }

    loadTasks() {
        try {
            const stored = localStorage.getItem(this.getStorageKey());
            this.tasks = stored ? JSON.parse(stored) : [];

            // If default user has no tasks, load sample data
            if (this.userId === 'default' && this.tasks.length === 0) {
                this.tasks = [
                    {
                        id: 1,
                        text: "Welcome to Todo Dashboard!",
                        priority: "medium",
                        completed: false,
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 2,
                        text: "Sign in with Google, GitHub, or Facebook to sync your tasks",
                        priority: "low",
                        completed: false,
                        createdAt: new Date().toISOString()
                    },
                    {
                        id: 3,
                        text: "Try adding a new task with different priorities",
                        priority: "high",
                        completed: false,
                        createdAt: new Date().toISOString()
                    }
                ];
                this.saveTasks();
            }
        } catch (e) {
            console.error('Error loading tasks:', e);
            this.tasks = [];
        }
    }

    saveTasks() {
        try {
            localStorage.setItem(this.getStorageKey(), JSON.stringify(this.tasks));
        } catch (e) {
            console.error('Error saving tasks:', e);
        }
    }

    addTask() {
        const input = document.getElementById('taskInput');
        const priority = document.getElementById('prioritySelect');
        const text = input.value.trim();

        if (!text) {
            input.focus();
            return;
        }

        const task = {
            id: Date.now(),
            text: text,
            priority: priority.value,
            completed: false,
            createdAt: new Date().toISOString(),
            userId: this.userId
        };

        this.tasks.unshift(task);
        this.saveTasks();
        this.render();
        this.updateStats();

        input.value = '';
        input.focus();
    }

    toggleTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (task) {
            task.completed = !task.completed;
            this.saveTasks();
            this.render();
            this.updateStats();
        }
    }

    deleteTask(id) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.saveTasks();
        this.render();
        this.updateStats();
    }

    clearCompleted() {
        this.tasks = this.tasks.filter(t => !t.completed);
        this.saveTasks();
        this.render();
        this.updateStats();
    }

    getFilteredTasks() {
        let filtered = this.tasks;

        // Filter by status
        if (this.currentFilter === 'active') {
            filtered = filtered.filter(t => !t.completed);
        } else if (this.currentFilter === 'completed') {
            filtered = filtered.filter(t => t.completed);
        }

        // Filter by search
        if (this.searchQuery) {
            filtered = filtered.filter(t =>
                t.text.toLowerCase().includes(this.searchQuery)
            );
        }

        return filtered;
    }

    render() {
        const container = document.getElementById('tasksContainer');
        const emptyState = document.getElementById('emptyState');
        const filtered = this.getFilteredTasks();

        if (filtered.length === 0) {
            container.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            container.style.display = 'flex';
            emptyState.style.display = 'none';

            container.innerHTML = filtered.map(task => this.renderTask(task)).join('');

            // Bind task events
            this.bindTaskEvents();
        }
    }

    renderTask(task) {
        const date = new Date(task.createdAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });

        return `
            <div class="task-item priority-${task.priority} ${task.completed ? 'completed' : ''}" data-id="${task.id}">
                <div class="task-checkbox ${task.completed ? 'checked' : ''}">
                    <i class="fas fa-check" style="display: ${task.completed ? 'block' : 'none'}"></i>
                </div>
                <div class="task-content">
                    <div class="task-text ${task.completed ? 'completed' : ''}">${this.escapeHtml(task.text)}</div>
                    <div class="task-meta">
                        <span><i class="fas fa-flag"></i> ${task.priority}</span>
                        <span><i class="far fa-calendar"></i> ${date}</span>
                    </div>
                </div>
                <div class="task-actions">
                    <button class="btn-action edit" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action delete" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    bindTaskEvents() {
        document.querySelectorAll('.task-item').forEach(item => {
            const id = parseInt(item.dataset.id);

            item.querySelector('.task-checkbox').addEventListener('click', () => {
                this.toggleTask(id);
            });

            item.querySelector('.btn-action.delete').addEventListener('click', () => {
                this.deleteTask(id);
            });

            item.querySelector('.btn-action.edit').addEventListener('click', () => {
                this.editTask(id);
            });
        });
    }

    editTask(id) {
        const task = this.tasks.find(t => t.id === id);
        if (!task) return;

        const newText = prompt('Edit task:', task.text);
        if (newText && newText.trim() !== task.text) {
            task.text = newText.trim();
            this.saveTasks();
            this.render();
        }
    }

    updateStats() {
        const total = this.tasks.length;
        const completed = this.tasks.filter(t => t.completed).length;
        const pending = total - completed;
        const highPriority = this.tasks.filter(t => t.priority === 'high' && !t.completed).length;

        document.getElementById('totalTasks').textContent = total;
        document.getElementById('pendingTasks').textContent = pending;
        document.getElementById('completedTasks').textContent = completed;
        document.getElementById('highPriorityTasks').textContent = highPriority;
    }

    updateDate() {
        const date = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        document.getElementById('currentDate').textContent = date;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.todoApp = new TodoApp();
    window.todoApp.init().catch(console.error);
});
