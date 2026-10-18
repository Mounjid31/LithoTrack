/**
 * LithoTrack — Firebase Auth + Firestore profiles
 * - Login required for app
 * - Email verification required
 * - Password reset supported
 */
const LithoAuth = {
  app: null,
  auth: null,
  db: null,
  ready: null,

  waitForSdk(timeoutMs) {
    timeoutMs = timeoutMs || 15000;
    return new Promise(function (resolve, reject) {
      var t0 = Date.now();
      (function tick() {
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) {
          resolve();
          return;
        }
        if (Date.now() - t0 > timeoutMs) {
          reject(new Error('Firebase SDK not loaded. Use https or Live Server + internet.'));
          return;
        }
        setTimeout(tick, 50);
      })();
    });
  },

  init() {
    if (this.ready) return this.ready;
    var self = this;
    this.ready = this.waitForSdk().then(function () {
      var cfg = window.LITHO_FIREBASE_CONFIG;
      if (!cfg || !cfg.apiKey) throw new Error('Missing firebase config');
      self.app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
      self.auth = firebase.auth();
      self.db = firebase.firestore();
      return self;
    });
    return this.ready;
  },

  isAdmin(email) {
    var list = window.LITHO_ADMIN_EMAILS || [];
    return !!email && list.map(function (e) {
      return String(e).toLowerCase().trim();
    }).indexOf(String(email).toLowerCase().trim()) >= 0;
  },

  saveProfile: async function (user, extra) {
    if (!user) return;
    extra = extra || {};
    var data = {
      uid: user.uid,
      email: (user.email || '').toLowerCase(),
      name: extra.name != null ? extra.name : (user.displayName || ''),
      emailVerified: !!user.emailVerified,
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
      provider: 'password'
    };
    if (extra.isNew) {
      data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
    }
    await this.db.collection('users').doc(user.uid).set(data, { merge: true });
  },

  signup: async function (name, email, password) {
    await this.init();
    email = String(email || '').trim().toLowerCase();
    name = String(name || '').trim();
    password = String(password || '');
    if (!email.includes('@')) throw new Error('Valid email required');
    if (password.length < 6) throw new Error('Password must be at least 6 characters');

    var cred = await this.auth.createUserWithEmailAndPassword(email, password);
    var user = cred.user;
    if (name) {
      try { await user.updateProfile({ displayName: name }); } catch (e) {}
    }

    try {
      await this.saveProfile(user, { name: name, isNew: true });
    } catch (e) {
      console.error('Firestore profile write failed:', e);
      throw new Error('Account created, but profile was not saved. Check Firestore Rules.');
    }
    return user;
  },

  login: async function (email, password) {
    await this.init();
    email = String(email || '').trim().toLowerCase();
    password = String(password || '');
    var cred = await this.auth.signInWithEmailAndPassword(email, password);
    var user = cred.user;

    try {
      await this.saveProfile(user, { isNew: false });
    } catch (e) {
      console.warn('profile update failed', e);
    }
    return user;
  },

  /** Send password reset email */
  resetPassword: async function (email) {
    await this.init();
    email = String(email || '').trim().toLowerCase();
    if (!email.includes('@')) throw new Error('Enter a valid email');
    await this.auth.sendPasswordResetEmail(email);
    return true;
  },

  /** Resend verification while signed in or after failed login attempt */
  resendVerification: async function (email, password) {
    await this.init();
    email = String(email || '').trim().toLowerCase();
    password = String(password || '');
    var cred = await this.auth.signInWithEmailAndPassword(email, password);
    var user = cred.user;
    await user.sendEmailVerification();
    await this.auth.signOut();
    return true;
  },

  logout: async function () {
    await this.init();
    await this.auth.signOut();
  },

  currentUser: function () {
    return this.auth ? this.auth.currentUser : null;
  },

  onAuth: function (cb) {
    return this.init().then(function (self) {
      return self.auth.onAuthStateChanged(cb);
    }).catch(function (err) {
      console.error(err);
      cb(null);
    });
  },

  /** Require logged-in user only (no email verification). */
  requireVerifiedUser: async function () {
    await this.init();
    var self = this;
    return new Promise(function (resolve) {
      var unsub = self.auth.onAuthStateChanged(function (user) {
        unsub();
        resolve(user || null);
      });
    });
  },

  requireUser: async function () {
    return this.requireVerifiedUser();
  },

  listUsers: async function () {
    await this.init();
    var snap;
    try {
      snap = await this.db.collection('users').get();
    } catch (e) {
      throw new Error('Cannot read users. Check Firestore Rules. ' + (e.message || e));
    }
    var list = snap.docs.map(function (d) {
      var x = d.data() || {};
      return {
        uid: d.id,
        email: x.email || '',
        name: x.name || '',
        emailVerified: !!x.emailVerified,
        createdAt: x.createdAt && x.createdAt.toDate ? x.createdAt.toDate() : null,
        lastLoginAt: x.lastLoginAt && x.lastLoginAt.toDate ? x.lastLoginAt.toDate() : null
      };
    });
    list.sort(function (a, b) {
      var ta = a.createdAt ? a.createdAt.getTime() : 0;
      var tb = b.createdAt ? b.createdAt.getTime() : 0;
      return tb - ta;
    });
    return list;
  }
};
