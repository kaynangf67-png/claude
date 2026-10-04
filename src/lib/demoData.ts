import { DAY, HOUR, uid } from './format';
import type { Business, Lead, Message, Sender } from './types';

export const DEMO_BUSINESS: Business = {
  name: 'Móveis Bela Casa',
  whatsapp: '(11) 98765-4321',
  segment: 'Loja de móveis',
  description:
    'Loja de móveis e colchões na Zona Leste de São Paulo há 12 anos. Atendimento pelo WhatsApp e na loja física.',
  hours: 'Seg a sex, 9h às 18h · Sáb, 9h às 13h',
  products: [
    { id: 'p1', name: 'Sofá retrátil 3 lugares', price: 2490 },
    { id: 'p2', name: 'Mesa de jantar 6 lugares', price: 1890 },
    { id: 'p3', name: 'Guarda-roupa casal 6 portas', price: 1590 },
    { id: 'p4', name: 'Colchão queen ortopédico', price: 1290 },
    { id: 'p5', name: 'Poltrona reclinável', price: 1190 },
    { id: 'p6', name: 'Cama box casal com colchão', price: 1990 },
    { id: 'p7', name: 'Rack com painel para TV até 65"', price: 890 },
    { id: 'p8', name: 'Cadeira de escritório ergonômica', price: 690 },
  ],
  faqs: [
    {
      id: 'f1',
      question: 'Quais as formas de pagamento?',
      answer: 'Aceitamos Pix, cartão de débito e cartão de crédito em até 10x sem juros.',
    },
    {
      id: 'f2',
      question: 'Vocês entregam?',
      answer: 'Entregamos em São Paulo e Grande SP. O prazo é combinado no fechamento do pedido.',
    },
    { id: 'f3', question: 'A montagem é cobrada?', answer: 'A montagem é gratuita para guarda-roupas, camas e racks.' },
    { id: 'f4', question: 'Posso trocar?', answer: 'Trocas em até 7 dias após o recebimento, com o produto sem uso.' },
  ],
};

type Script = [Sender, string, number][]; // [quem, texto, horas atrás]

function conversation(script: Script, now: number, followupIdx: number[] = []): Message[] {
  return script.map(([from, text, hoursAgo], i) => ({
    id: uid(),
    from,
    text,
    at: new Date(now - hoursAgo * HOUR).toISOString(),
    ...(followupIdx.includes(i) ? { isFollowup: true } : {}),
  }));
}

export function buildDemoLeads(now = Date.now()): Lead[] {
  const lead = (l: Omit<Lead, 'id' | 'createdAt'> & { createdHoursAgo?: number }): Lead => {
    const { createdHoursAgo, ...rest } = l;
    const first = rest.messages[0]?.at;
    return {
      id: uid(),
      createdAt: first ?? new Date(now - (createdHoursAgo ?? 0) * HOUR).toISOString(),
      ...rest,
    };
  };

  return [
    lead({
      name: 'João Silva',
      phone: '(11) 99812-3344',
      productName: 'Sofá retrátil 3 lugares',
      value: 2490,
      status: 'interessado',
      followupsSent: 0,
      messages: conversation(
        [
          ['cliente', 'Oi, quanto custa o sofá retrátil?', 49],
          ['empresa', 'Olá! O sofá retrátil custa R$ 2.490.', 48.9],
          ['cliente', 'Tem em outras cores?', 48.7],
          ['empresa', 'Temos em cinza, bege e azul-marinho. Quer que eu mande as fotos?', 48.5],
          ['cliente', 'Vou conversar com minha esposa e depois te falo.', 48.2],
        ],
        now,
      ),
    }),
    lead({
      name: 'Mariana Costa',
      phone: '(11) 97455-1020',
      productName: 'Mesa de jantar 6 lugares',
      value: 1890,
      status: 'interessado',
      followupsSent: 0,
      messages: conversation(
        [
          ['cliente', 'Boa tarde! Qual o valor da mesa de jantar de 6 lugares?', 27],
          ['empresa', 'Boa tarde, Mariana! Ela sai por R$ 1.890.', 26.8],
          ['cliente', 'Consegue parcelar?', 26.5],
          ['empresa', 'Sim! Aceitamos Pix, débito e crédito em até 10x sem juros.', 26.3],
          ['cliente', 'Ah legal. Vou pensar e te aviso!', 26],
        ],
        now,
      ),
    }),
    lead({
      name: 'Lucas Pereira',
      phone: '(11) 96321-8890',
      productName: 'Rack com painel para TV até 65"',
      value: 890,
      status: 'novo',
      followupsSent: 0,
      messages: conversation(
        [['cliente', 'Oi! Vocês tem rack pra TV de 65 polegadas? Qual o valor e entrega em Guarulhos?', 3]],
        now,
      ),
    }),
    lead({
      name: 'Ricardo Alves',
      phone: '(11) 98100-7765',
      productName: 'Poltrona reclinável',
      value: 1190,
      status: 'followup',
      followupsSent: 1,
      lastFollowupAt: new Date(now - 20 * HOUR).toISOString(),
      messages: conversation(
        [
          ['cliente', 'Quanto tá a poltrona reclinável?', 74],
          ['empresa', 'Oi, Ricardo! A poltrona reclinável custa R$ 1.190.', 73.5],
          ['cliente', 'Vcs entregam no Tatuapé?', 73],
          ['empresa', 'Entregamos sim! Atendemos São Paulo e Grande SP.', 72.5],
          ['cliente', 'Beleza, vou ver aqui e te retorno', 72],
          [
            'empresa',
            'Oi, Ricardo! Tudo bem? Ficou alguma dúvida sobre a poltrona reclinável? Se quiser, te mando mais fotos 😊',
            20,
          ],
        ],
        now,
        [5],
      ),
    }),
    lead({
      name: 'Carlos Henrique',
      phone: '(11) 99001-2233',
      productName: 'Colchão queen ortopédico',
      value: 1290,
      status: 'interessado',
      followupsSent: 0,
      messages: conversation(
        [
          ['cliente', 'Boa noite, quanto é o colchão queen ortopédico?', 76],
          ['empresa', 'Boa noite, Carlos! O colchão queen ortopédico sai por R$ 1.290.', 75],
        ],
        now,
      ),
    }),
    lead({
      name: 'Fernanda Lima',
      phone: '(11) 95544-6677',
      productName: 'Guarda-roupa casal 6 portas',
      value: 1590,
      status: 'interessado',
      followupsSent: 0,
      messages: conversation(
        [
          ['cliente', 'Oi! Qual o preço do guarda-roupa casal de 6 portas?', 122],
          ['empresa', 'Oi, Fernanda! Ele custa R$ 1.590, com montagem grátis.', 121],
          ['cliente', 'Achei um pouco caro... vou pesquisar mais um pouco.', 120],
        ],
        now,
      ),
    }),
    lead({
      name: 'Patrícia Souza',
      phone: '(11) 94433-1209',
      productName: 'Cama box casal com colchão',
      value: 1990,
      status: 'interessado',
      followupsSent: 0,
      messages: conversation(
        [
          ['cliente', 'Bom dia. Quanto fica a cama box casal com colchão?', 220],
          ['empresa', 'Bom dia, Patrícia! O conjunto sai por R$ 1.990.', 219],
          ['cliente', 'Ok, semana que vem eu volto a falar com vocês', 218],
        ],
        now,
      ),
    }),
    lead({
      name: 'Beatriz Rocha',
      phone: '(11) 93322-4455',
      productName: 'Cadeira de escritório ergonômica',
      value: 690,
      status: 'perdido',
      followupsSent: 1,
      lastFollowupAt: new Date(now - 6 * DAY).toISOString(),
      messages: conversation(
        [
          ['cliente', 'Quanto custa a cadeira de escritório ergonômica?', 8 * 24],
          ['empresa', 'Oi, Beatriz! Ela custa R$ 690.', 8 * 24 - 1],
          ['empresa', 'Oi, Beatriz! Ficou alguma dúvida sobre a cadeira? 😊', 6 * 24],
          ['cliente', 'Oi! Já comprei em outro lugar, obrigada.', 6 * 24 - 2],
        ],
        now,
        [2],
      ),
    }),
    lead({
      name: 'Ana Paula Martins',
      phone: '(11) 98777-3311',
      productName: 'Sofá retrátil 3 lugares',
      value: 2490,
      status: 'recuperado',
      followupsSent: 1,
      lastFollowupAt: new Date(now - 4 * DAY).toISOString(),
      recoveredAt: new Date(now - 3 * DAY).toISOString(),
      messages: conversation(
        [
          ['cliente', 'Oi, o sofá retrátil ainda está R$ 2.490?', 7 * 24],
          ['empresa', 'Oi, Ana Paula! Está sim, R$ 2.490.', 7 * 24 - 1],
          ['cliente', 'Vou falar com meu marido', 7 * 24 - 2],
          [
            'empresa',
            'Oi, Ana Paula! Tudo bem? 😊 Conseguiu conversar com seu marido sobre o sofá retrátil? Se tiver dúvida sobre pagamento, posso te ajudar.',
            4 * 24,
          ],
          ['cliente', 'Conversei sim! Vamos levar. Pode parcelar em 10x?', 4 * 24 - 1],
          ['empresa', 'Pode sim! Em até 10x sem juros no cartão. Vou te mandar o link do pedido.', 4 * 24 - 1.5],
          ['cliente', 'Paguei! Segue o comprovante 🙌', 3 * 24],
        ],
        now,
        [3],
      ),
    }),
    lead({
      name: 'Roberto Nunes',
      phone: '(11) 97666-8800',
      productName: 'Guarda-roupa casal 6 portas',
      value: 1590,
      status: 'recuperado',
      followupsSent: 1,
      lastFollowupAt: new Date(now - 6 * DAY).toISOString(),
      recoveredAt: new Date(now - 5 * DAY).toISOString(),
      messages: conversation(
        [
          ['cliente', 'Qual o valor do guarda-roupa de 6 portas?', 9 * 24],
          ['empresa', 'Olá, Roberto! Ele sai por R$ 1.590 com montagem grátis.', 9 * 24 - 1],
          ['cliente', 'Vou pensar', 9 * 24 - 2],
          [
            'empresa',
            'Oi, Roberto! Passando pra saber se ficou alguma dúvida sobre o guarda-roupa. A montagem é por nossa conta 😊',
            6 * 24,
          ],
          ['cliente', 'Fechado, pode separar um pra mim', 5 * 24],
        ],
        now,
        [3],
      ),
    }),
  ];
}
