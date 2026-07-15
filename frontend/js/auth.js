class Auth {
  static async login(username, password) {
    const result = await API.login({ username, password });
    console.log('Login response:', result);
    
    if (!result) {
      throw new Error('No response from server');
    }
    
    if (result.error) {
      throw new Error(result.error);
    }
    
    if (result.token && result.user) {
      localStorage.setItem('token', result.token);
      localStorage.setItem('user', JSON.stringify(result.user));
      return result.user;
    }
    
    throw new Error('Invalid login response - missing token or user data');
  }

  static async register(data) {
    const result = await API.register(data);
    if (result.userId) {
      return result;
    }
    throw new Error(result.error || 'Registration failed');
  }

  static logout() {
    localStorage.clear();
    window.location.href = '/';
  }

  static isAuthenticated() {
    return !!localStorage.getItem('token');
  }

  static getUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  static hasRole(roles) {
    const user = this.getUser();
    return user && roles.includes(user.role);
  }

  static hasModule(module) {
    const user = this.getUser();
    if (!user) return false;
    if (user.role === 'admin') return true;
    const perm = user.module_permissions && user.module_permissions[module];
    if (!perm) return false;
    // BUG FIX: module_permissions[module] is now an object like
    // {view, create, edit, delete, approve}, not a plain boolean — an
    // empty-of-access object like {view:false,...} is still truthy, so a
    // simple `!!perm` check used to show nav items for users with zero
    // actual access to that module. Now checks if any action is granted.
    if (typeof perm === 'boolean') return perm;
    return Object.values(perm).some(Boolean);
  }
}
