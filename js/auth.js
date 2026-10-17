/**
 * LithoTrack — Firebase Authentication + user profiles (Firestore)
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
          reject(new Error('Firebase SDK not loaded. Open the app via Live Server (http://) not as a local file, and check internet.'));
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
    return !!email && list.map(function (e) { return String(e).toLowerCase(); }).indexOf(String(email).toLowerCase()) >= 0;
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
    var profile = {
      uid: user.uid,
      email: user.email,
      name: name || '',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastLoginAt: firebase.firestore.FieldValue.serverTimestamp(),
      provider: 'password'
    };
    await this.db.collection('users').doc(user.uid).set(profile, { merge: true });
    return user;
  },

  login: async function (email, password) {
    await this.init();
    email = String(email || '').trim().toLowerCase();
    password = String(password || '');
    var cred = await this.auth.signInWithEmailAndPassword(email, password);
    var user = cred.user;
    try {
      await this.db.collection('users').doc(user.uid).set({
        email: user.email,
        name: user.displayName || '',
        lastLoginAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn('profile update failed', e);
    }
    return user;
  },

  logout: async function () {
    await this.init();
    await this.auth.signOut();
    try { localStorage.removeItem('lithotrack_session'); } catch (e) {}
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

  requireUser: async function () {
    await this.init();
    var self = this;
    return new Promise(function (resolve) {
      var unsub = self.auth.onAuthStateChanged(function (user) {
        unsub();
        resolve(user || null);
      });
    });
  },

  listUsers: async function () {
    await this.init();
    var snap = await this.db.collection('users').orderBy('createdAt', 'desc').limit(500).get();
    return snap.docs.map(function (d) {
      var x = d.data() || {};
      return {
        uid: d.id,
        email: x.email || '',
        name: x.name || '',
        createdAt: x.createdAt && x.createdAt.toDate ? x.createdAt.toDate() : null,
        lastLoginAt: x.lastLoginAt && x.lastLoginAt.toDate ? x.lastLoginAt.toDate() : null
      };
    });
  }
};
