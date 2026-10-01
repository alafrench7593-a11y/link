// La sauvegarde sur le téléphone.
//
// Le moteur attend un stockage avec trois méthodes : load, save, clear. AsyncStorage
// les fournit telles quelles. Quand le mode en ligne est branché, il suffit de passer
// un HttpStore à la place : rien d'autre ne change dans l'app.
import AsyncStorage from '@react-native-async-storage/async-storage';

export class PhoneStore {
  constructor(key) { this.key = key || 'linkfoot.save'; }

  async load() {
    try {
      const raw = await AsyncStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  async save(payload) {
    try { await AsyncStorage.setItem(this.key, JSON.stringify(payload)); return true; }
    catch (e) { return false; }
  }

  async clear() {
    try { await AsyncStorage.removeItem(this.key); return true; }
    catch (e) { return false; }
  }
}
