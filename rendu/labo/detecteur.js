// Le détecteur de pied du cœur C++ (LFDetecteurs.h, DetecteurPied), rejoué ici sur le rendu :
// un pied à moins de 3 cm de sa hauteur de repos est au sol ; s'il y va à plus de 15 cm/s pendant
// au moins 0,1 s, c'est un glissement (la porte de qualité dit alors NE PAS LIVRER).
export class DetecteurPied {
  constructor(hauteurRepos, seuils = {}) {
    this.h0 = hauteurRepos;
    this.s = Object.assign({ contactCm: 3, glisseCmS: 15, dureeS: 0.1 }, seuils);
    this.prec = null; this.debut = -1; this.glissements = 0; this.enCours = false; this.imagesAuSol = 0; this.pire = 0;
  }
  ajouter(t, x, y, z) {
    const auSol = (y - this.h0) * 100 < this.s.contactCm;
    if (this.prec && auSol && this.prec.auSol) {
      const dt = t - this.prec.t;
      const v = dt > 0 ? Math.hypot(x - this.prec.x, z - this.prec.z) / dt * 100 : 0;
      this.imagesAuSol++;
      if (v > this.s.glisseCmS) {
        if (this.debut < 0) this.debut = this.prec.t;
        if (t - this.debut >= this.s.dureeS && !this.enCours) {
          this.glissements++; this.enCours = true;
          (this.evenements || (this.evenements = [])).push({ t: +t.toFixed(3), vCmS: Math.round(v), hCm: +((y - this.h0) * 100).toFixed(1), etat: this.etat || '' });
        }
        this.pire = Math.max(this.pire, v);
      } else { this.debut = -1; this.enCours = false; }
    } else { this.debut = -1; this.enCours = false; }
    this.prec = { t, x, z, auSol };
  }
  // pendant un geste qui glisse ou couche le corps (tacle glissé, chute), le pied n'est pas
  // jugé ; les images sont comptées à part, et la mesure reprend de zéro après
  suspendre(t) {
    this.imagesSuspendues = (this.imagesSuspendues || 0) + 1;
    this.prec = null; this.debut = -1; this.enCours = false;
  }
}
