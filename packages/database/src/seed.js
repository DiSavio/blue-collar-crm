function createSeed() {
  const now = Date.now();
  const hoursAgo = (hours) => new Date(now - hours * 60 * 60 * 1000).toISOString();
  const today = new Date(now).toISOString().slice(0, 10);
  const tomorrow = new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const autoReply = 'Merci d’avoir contacté MLProcour. Nous avons bien reçu votre message et vous répondrons bientôt. / Thanks for contacting MLProcour. We received your message and will get back to you soon.';

  return {
    version: 2,
    customers: [
      { id: 'cus_1001', name: 'Mélanie Roy', phone: '(450) 555-0182', email: 'melanie.roy@example.ca', serviceAddress: '382, rue Saint-Charles O, Longueuil, QC', source: 'Google', notes: 'Préfère les textos. / Prefers text updates.', status: 'active', createdAt: hoursAgo(120) },
      { id: 'cus_1002', name: 'Syndicat du Parc Riverside', phone: '(450) 555-0137', email: 'entretien@riverside.example.ca', serviceAddress: '7100, boulevard du Quartier, Brossard, QC', source: 'Referral', notes: 'Entretien des aires communes et des haies. / Common-area lawn and hedge service.', status: 'active', createdAt: hoursAgo(90) },
      { id: 'cus_1003', name: 'Émile Gagnon', phone: '(438) 555-0164', email: 'emile.gagnon@example.ca', serviceAddress: '51, rue Saint-Georges, Saint-Lambert, QC', source: 'Yard sign', notes: '', status: 'lead', createdAt: hoursAgo(38) },
      { id: 'cus_1004', name: 'Café du Vieux-Saint-Lambert', phone: '(450) 555-0198', email: 'gestion@cafeduvieux.example.ca', serviceAddress: '212, avenue Victoria, Saint-Lambert, QC', source: 'Repeat customer', notes: 'Accès par la ruelle. / Use the lane entrance.', status: 'active', createdAt: hoursAgo(320) },
      { id: 'cus_1005', name: 'Alex Nguyen', phone: '(514) 555-0173', email: '', serviceAddress: '708, rue des Érables, La Prairie, QC', source: 'Website', notes: '', status: 'lead', createdAt: hoursAgo(5) },
    ],
    jobs: [
      { id: 'job_2001', title: 'Nettoyage printanier et paillis', customerId: 'cus_1001', address: '382, rue Saint-Charles O, Longueuil, QC', scheduledFor: `${today}T09:00:00`, status: 'scheduled', amount: 685, notes: 'Protéger les vivaces près de la terrasse. / Protect the perennials by the patio.', createdAt: hoursAgo(72) },
      { id: 'job_2002', title: 'Tonte et taille des haies', customerId: 'cus_1002', address: '7100, boulevard du Quartier, Brossard, QC', scheduledFor: `${today}T11:30:00`, status: 'in_progress', amount: 940, notes: 'Passage aux deux semaines. / Biweekly service.', createdAt: hoursAgo(44) },
      { id: 'job_2003', title: 'Nouvelle plate-bande avant', customerId: 'cus_1003', address: '51, rue Saint-Georges, Saint-Lambert, QC', scheduledFor: '', status: 'estimate', amount: 0, notes: 'Confirmer les végétaux et les bordures. / Confirm plants and edging.', createdAt: hoursAgo(18) },
      { id: 'job_2004', title: 'Préparation et pose de tourbe', customerId: 'cus_1004', address: '212, avenue Victoria, Saint-Lambert, QC', scheduledFor: `${tomorrow}T14:00:00`, status: 'scheduled', amount: 1250, notes: 'Coordonner l’accès par la ruelle. / Coordinate lane access.', createdAt: hoursAgo(26) },
    ],
    messages: [
      { id: 'msg_3001', customerId: 'cus_1005', text: 'Bonjour, nous aimerions faire nettoyer la cour et ajouter du paillis. Avez-vous une disponibilité cette semaine?', direction: 'inbound', channel: 'sms', createdAt: hoursAgo(2) },
      { id: 'msg_3002', customerId: 'cus_1005', text: autoReply, direction: 'outbound', channel: 'sms', createdAt: hoursAgo(2) },
      { id: 'msg_3003', customerId: 'cus_1003', text: 'Pourriez-vous nous préparer une soumission pour refaire la plate-bande avant?', direction: 'inbound', channel: 'sms', createdAt: hoursAgo(19) },
      { id: 'msg_3004', customerId: 'cus_1003', text: autoReply, direction: 'outbound', channel: 'sms', createdAt: hoursAgo(19) },
      { id: 'msg_3005', customerId: 'cus_1001', text: 'Parfait, jeudi matin nous convient. Merci!', direction: 'inbound', channel: 'sms', createdAt: hoursAgo(29) },
    ],
    automations: [
      { id: 'instant-reply', name: 'Réponse automatique aux demandes', description: 'Confirme la réception des nouveaux messages et précise le suivi.', enabled: true, trigger: 'À la réception d’un nouveau message', response: autoReply },
      { id: 'missed-call', name: 'Suivi après un appel manqué', description: 'Écrivez à un nouveau client après un appel manqué.', enabled: false, trigger: 'Lorsqu’un appel est manqué', response: 'Désolé, nous avons manqué votre appel. Répondez à ce texto et nous vous rappellerons. / Sorry we missed your call. Reply here and we will call you back.' },
      { id: 'appointment-reminder', name: 'Rappel de travaux', description: 'Préparez un rappel avant les travaux extérieurs planifiés.', enabled: false, trigger: 'La veille des travaux planifiés', response: 'Rappel : notre équipe est prévue demain. Répondez si vos plans ont changé. / Reminder: our crew is scheduled for tomorrow. Reply if anything has changed.' },
    ],
  };
}

const LEGACY_DEMO_IDS = new Set([
  'cus_5297b25b-1946-4375-aec0-75a482b5f992',
  'job_306b1658-d7ba-42df-a5f2-dc4a575f55f9',
  'msg_ab98ee51-9f3a-484a-bf4d-203c26580d77',
  'msg_827d7590-77a0-41ac-9244-7c0dd9bcbe97',
  'msg_81b82dd0-a466-4991-8f61-c742b8cee573',
  'msg_f8ca8e74-4273-4c3e-956c-c38a01e9e0c3',
]);

module.exports = { createSeed, LEGACY_DEMO_IDS };