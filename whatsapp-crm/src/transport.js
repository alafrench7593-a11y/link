// Envoi réel via le SDK officiel Kapso (@kapso/whatsapp-cloud-api), soit par le
// proxy Kapso, soit en direct sur la Cloud API de Meta. En mode « simulation »
// rien ne sort de la machine et chaque message est marqué comme tel.
import { WhatsAppClient } from '@kapso/whatsapp-cloud-api';

export function createTransport(cfg, { fetchImpl } = {}) {
  if (cfg.provider === 'simulation') return simulationTransport();
  if (cfg.provider === 'lien') return linkTransport();
  const client = cfg.provider === 'kapso'
    ? new WhatsAppClient({ baseUrl: `${cfg.kapsoBaseUrl.replace(/\/$/, '')}/meta/whatsapp`, kapsoApiKey: cfg.kapsoApiKey, graphVersion: cfg.graphVersion, fetch: fetchImpl })
    : new WhatsAppClient({ accessToken: cfg.metaAccessToken, graphVersion: cfg.graphVersion, fetch: fetchImpl });
  if (!cfg.phoneNumberId) throw new Error('WA_PHONE_NUMBER_ID manquant : impossible d’envoyer sans identifiant de numéro.');

  return {
    name: cfg.provider,
    simulated: false,
    async sendText(to, body) {
      const res = await client.messages.sendText({ phoneNumberId: cfg.phoneNumberId, to, body });
      return { wamid: pickId(res) };
    },
    async sendTemplate(to, name, lang, params = []) {
      const components = params.length
        ? [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text: String(text) })) }]
        : undefined;
      const res = await client.messages.sendTemplate({
        phoneNumberId: cfg.phoneNumberId, to, template: { name, language: { code: lang }, components },
      });
      return { wamid: pickId(res) };
    },
    // Qualité et palier d'envoi du numéro (champs Graph API du numéro).
    async quality() {
      return client.request('GET', cfg.phoneNumberId, {
        query: { fields: 'display_phone_number,verified_name,quality_rating,messaging_limit_tier,throughput,name_status' },
        responseType: 'json',
      });
    },
    async listTemplates(wabaId) {
      return client.templates.list({ businessAccountId: wabaId });
    },
  };
}

function pickId(res) {
  const id = res?.messages?.[0]?.id;
  if (!id) throw new Error('Réponse WhatsApp sans identifiant de message : ' + JSON.stringify(res).slice(0, 200));
  return id;
}

let simSeq = 0;
function simulationTransport() {
  return {
    name: 'simulation',
    simulated: true,
    async sendText() { return { wamid: `sim.${Date.now()}.${++simSeq}` }; },
    async sendTemplate() { return { wamid: `sim.${Date.now()}.${++simSeq}` }; },
    async quality() { return { simulated: true }; },
    async listTemplates() { return { data: [], simulated: true }; },
  };
}

// Envoi par vous-même : le système prépare un lien wa.me, WhatsApp s'ouvre avec le
// texte, vous appuyez sur Envoyer. Aucun envoi automatique possible dans ce mode.
function linkTransport() {
  const refuse = async () => { throw new Error('Mode lien : ouvrez le message dans WhatsApp depuis le tableau de bord.'); };
  return {
    name: 'lien',
    simulated: false,
    manual: true,
    sendText: refuse,
    sendTemplate: refuse,
    async quality() { return { manual: true }; },
    async listTemplates() { return { data: [], manual: true }; },
  };
}

export function whatsappLink(phone, text) {
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
}
