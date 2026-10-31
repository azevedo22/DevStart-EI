/**
 * Frase do dia: uma por dia, de pessoas que construíram a tecnologia e as
 * empresas da área. Cada frase tem fonte verificável (discurso, entrevista,
 * livro): muitas citações que circulam na internet são inventadas, e a app
 * não as quer espalhar. As traduções são livres; o original vai junto.
 *
 * O contexto escolhe o conjunto: depois de uma rejeição, frases sobre
 * persistência; com uma entrevista à porta, sobre crescer e arriscar; ao fim
 * de semana, para refletir. Nos outros dias, todas.
 */
import { weekday } from './daily-goals';

export type QuoteContext = 'rejection' | 'interview' | 'weekend';

export interface DailyQuote {
  id: string;
  /** Tradução livre em português de Portugal. */
  text: string;
  original: string;
  author: string;
  /** Quem é, em poucas palavras, e onde o disse. */
  role: string;
  source: { label: string; url: string };
  contexts: readonly QuoteContext[];
}

const STANFORD_2005 = {
  label: 'Discurso em Stanford, 2005',
  url: 'https://news.stanford.edu/stories/2005/06/youve-got-find-love-jobs-says',
};
const HOUSTON_MIT_2013 = {
  label: 'Discurso no MIT, 2013',
  url: 'https://www.networkworld.com/article/674786/dropbox-ceo-drew-houstons-2013-mit-commencement-address-transcript.html',
};
const BEZOS_PRINCETON_2010 = {
  label: 'Discurso em Princeton, 2010',
  url: 'https://www.princeton.edu/news/2010/05/30/2010-baccalaureate-remarks',
};
const ZUCKERBERG_HARVARD_2017 = {
  label: 'Discurso em Harvard, 2017',
  url: 'https://singjupost.com/facebook-ceo-mark-zuckerbergs-harvard-commencement-speech-full-transcript/',
};
const HUANG_CALTECH_2024 = {
  label: 'Discurso no Caltech, 2024',
  url: 'https://blogs.nvidia.com/blog/jensen-huang-caltech-commencement-address',
};
const PICHAI_2020 = {
  label: 'Mensagem aos finalistas de 2020',
  url: 'https://blog.google/intl/en-in/products/platforms/you-will-prevail-message-to-class-of/',
};
const PAGE_MICHIGAN_2009 = {
  label: 'Discurso na Universidade do Michigan, 2009',
  url: 'https://www.networkworld.com/article/781126/google-co-founder-larry-pages-2009-university-of-michigan-commencement-speech-transcript.html',
};

/**
 * A ordem importa: nos dias sem contexto, as frases seguem esta lista, um
 * dia cada, por isso os autores estão intercalados e nada se repete durante
 * mais de um mês.
 */
export const DAILY_QUOTES: readonly DailyQuote[] = [
  {
    id: 'houston-right-once',
    text: 'A partir de agora, o falhanço não importa: só precisas de acertar uma vez.',
    original:
      'From now on, failure doesn’t matter: You only have to be right once.',
    author: 'Drew Houston',
    role: 'Fundador da Dropbox',
    source: HOUSTON_MIT_2013,
    contexts: ['rejection'],
  },
  {
    id: 'torvalds-show-code',
    text: 'Falar é fácil. Mostra-me o código.',
    original: 'Talk is cheap. Show me the code.',
    author: 'Linus Torvalds',
    role: 'Criador do Linux',
    source: {
      label: 'Mailing list do kernel Linux, 2000',
      url: 'https://lkml.iu.edu/hypermail/linux/kernel/0009.2/0253.html',
    },
    contexts: [],
  },
  {
    id: 'rometty-growth-comfort',
    text: 'Crescimento e conforto não coexistem.',
    original: 'Growth and comfort do not coexist.',
    author: 'Ginni Rometty',
    role: 'Ex-CEO da IBM',
    source: {
      label: 'Fortune, 2011',
      url: 'https://fortune.com/2011/10/05/ibms-ginni-rometty-growth-and-comfort-do-not-coexist',
    },
    contexts: ['interview'],
  },
  {
    id: 'jobs-brick',
    text: 'Às vezes a vida acerta-te na cabeça com um tijolo. Não percas a fé.',
    original:
      'Sometimes life hits you in the head with a brick. Don’t lose faith.',
    author: 'Steve Jobs',
    role: 'Cofundador da Apple',
    source: STANFORD_2005,
    contexts: ['rejection'],
  },
  {
    id: 'zuckerberg-get-started',
    text: 'As ideias não nascem completas. Só ficam claras à medida que trabalhas nelas. Só tens de começar.',
    original:
      'Ideas don’t come out fully formed. They only become clear as you work on them. You just have to get started.',
    author: 'Mark Zuckerberg',
    role: 'Fundador do Facebook',
    source: ZUCKERBERG_HARVARD_2017,
    contexts: [],
  },
  {
    id: 'mayer-unprepared',
    text: 'Procura as pessoas mais inteligentes e faz algo para que te sintas um pouco despreparado.',
    original:
      'Look for the smartest people and do something you feel a little unprepared to do.',
    author: 'Marissa Mayer',
    role: 'Ex-CEO da Yahoo e uma das primeiras engenheiras da Google',
    source: {
      label: 'Stanford Graduate School of Business',
      url: 'https://www.gsb.stanford.edu/insights/marissa-mayer-do-something-you-feel-unprepared-do',
    },
    contexts: ['interview'],
  },
  {
    id: 'turing-short-distance',
    text: 'Só conseguimos ver um pouco à frente, mas conseguimos ver muito que precisa de ser feito.',
    original:
      'We can only see a short distance ahead, but we can see plenty there that needs to be done.',
    author: 'Alan Turing',
    role: 'Pai da ciência da computação, em «Computing Machinery and Intelligence» (1950)',
    source: {
      label: 'MacTutor, Universidade de St Andrews',
      url: 'https://mathshistory.st-andrews.ac.uk/Biographies/Turing/quotations',
    },
    contexts: ['weekend'],
  },
  {
    id: 'bezos-tried-failed',
    text: 'Se tentar e falhar, nunca me vou arrepender de ter tentado e falhado.',
    original: 'If I try and fail, I’ll never regret having tried and failed.',
    author: 'Jeff Bezos',
    role: 'Fundador da Amazon, sobre deixar o emprego para a fundar',
    source: {
      label: 'CNBC, 2020',
      url: 'https://www.cnbc.com/2020/01/17/at-age-30-jeff-bezos-thought-this-would-be-his-one-big-regret-in-life.html',
    },
    contexts: ['rejection'],
  },
  {
    id: 'hoffman-embarrassed',
    text: 'Se não tens vergonha da primeira versão do teu produto, lançaste tarde demais.',
    original:
      'If you’re not embarrassed by the first version of your product, you’ve launched too late.',
    author: 'Reid Hoffman',
    role: 'Cofundador do LinkedIn',
    source: {
      label: 'Ensaio no LinkedIn, 2017',
      url: 'https://www.linkedin.com/pulse/arent-any-typos-essay-we-launched-too-late-reid-hoffman/',
    },
    contexts: [],
  },
  {
    id: 'huang-setbacks',
    text: 'Contratempo atrás de contratempo, sacudimos o pó e seguimos para a oportunidade seguinte.',
    original:
      'One setback after another, we shook it off and skated to the next opportunity.',
    author: 'Jensen Huang',
    role: 'Fundador e CEO da NVIDIA',
    source: HUANG_CALTECH_2024,
    contexts: ['rejection'],
  },
  {
    id: 'pichai-open-impatient-hopeful',
    text: 'Sê aberto… sê impaciente… tem esperança.',
    original: 'Be open … be impatient … be hopeful.',
    author: 'Sundar Pichai',
    role: 'CEO da Google',
    source: PICHAI_2020,
    contexts: [],
  },
  {
    id: 'jobs-connect-dots',
    text: 'Não consegues ligar os pontos olhando para a frente; só os consegues ligar olhando para trás.',
    original:
      'You can’t connect the dots looking forward; you can only connect them looking backward.',
    author: 'Steve Jobs',
    role: 'Cofundador da Apple',
    source: STANFORD_2005,
    contexts: ['weekend'],
  },
  {
    id: 'nadella-learn-it-all',
    text: 'A longo prazo, quem quer aprender tudo ganha sempre a quem acha que já sabe tudo.',
    original:
      'The learn-it-all will always trump the know-it-all in the long run.',
    author: 'Satya Nadella',
    role: 'CEO da Microsoft',
    source: {
      label: 'GeekWire, 2016',
      url: 'https://www.geekwire.com/2016/microsoft-learn-it-all',
    },
    contexts: ['interview'],
  },
  {
    id: 'zuckerberg-freedom-fail',
    text: 'Os maiores sucessos nascem da liberdade de falhar.',
    original: 'The greatest successes come from having the freedom to fail.',
    author: 'Mark Zuckerberg',
    role: 'Fundador do Facebook',
    source: ZUCKERBERG_HARVARD_2017,
    contexts: ['rejection'],
  },
  {
    id: 'page-grab-dream',
    text: 'Quando aparecer um sonho mesmo bom, agarra-o!',
    original: 'When a really great dream shows up, grab it!',
    author: 'Larry Page',
    role: 'Cofundador da Google',
    source: PAGE_MICHIGAN_2009,
    contexts: [],
  },
  {
    id: 'perkins-patience',
    text: 'Paciência, para mim, soa a ficar sentada à beira da estrada à espera que as coisas aconteçam. E não é nada assim que funciona.',
    original:
      'Patience, to me, sounds like you’re sitting on the side of the road just hoping things will happen. And that’s far from the way it works.',
    author: 'Melanie Perkins',
    role: 'Cofundadora e CEO da Canva (recusada por mais de 100 investidores)',
    source: {
      label: 'Fortune',
      url: 'https://fortune.com/longform/melanie-perkins-canva-founder-ceo-interview',
    },
    contexts: [],
  },
  {
    id: 'bezos-relentless',
    text: 'Quando for difícil, vais desistir ou vais ser implacável?',
    original: 'When it’s tough, will you give up, or will you be relentless?',
    author: 'Jeff Bezos',
    role: 'Fundador da Amazon',
    source: BEZOS_PRINCETON_2010,
    contexts: ['rejection'],
  },
  {
    id: 'kay-invent-future',
    text: 'A melhor forma de prever o futuro é inventá-lo.',
    original: 'The best way to predict the future is to invent it.',
    author: 'Alan Kay',
    role: 'Pioneiro da Xerox PARC e da programação orientada a objetos',
    source: {
      label: 'Quote Investigator',
      url: 'https://quoteinvestigator.com/2012/09/27/invent-the-future/',
    },
    contexts: [],
  },
  {
    id: 'jobs-keep-looking',
    text: 'Se ainda não o encontraste, continua à procura. Não te acomodes.',
    original: 'If you haven’t found it yet, keep looking. Don’t settle.',
    author: 'Steve Jobs',
    role: 'Cofundador da Apple',
    source: STANFORD_2005,
    contexts: ['rejection'],
  },
  {
    id: 'sandberg-done',
    text: 'Feito é melhor do que perfeito.',
    original: 'Done is better than perfect.',
    author: 'Sheryl Sandberg',
    role: 'Ex-COO do Facebook, em «Lean In» (2013)',
    source: {
      label: 'YourStory',
      url: 'https://yourstory.com/2016/08/sheryl-sandberg-birthday',
    },
    contexts: [],
  },
  {
    id: 'houston-tennis-ball',
    text: 'Não se trata de te empurrares a ti próprio; trata-se de encontrares a tua bola de ténis, aquilo que te puxa.',
    original:
      'It’s not about pushing yourself; it’s about finding your tennis ball, the thing that pulls you.',
    author: 'Drew Houston',
    role: 'Fundador da Dropbox',
    source: HOUSTON_MIT_2013,
    contexts: ['weekend'],
  },
  {
    id: 'huang-unconventional',
    text: 'Espero que acreditem em alguma coisa. Algo fora do comum, algo por explorar.',
    original:
      'I hope you believe in something. Something unconventional, something unexplored.',
    author: 'Jensen Huang',
    role: 'Fundador e CEO da NVIDIA',
    source: HUANG_CALTECH_2024,
    contexts: ['interview'],
  },
  {
    id: 'hopper-always-done',
    text: 'A frase mais perigosa que um gestor pode dizer: «Sempre fizemos assim.»',
    original:
      'The most dangerous phrase a DP manager can use: “We’ve always done it that way.”',
    author: 'Grace Hopper',
    role: 'Pioneira da programação e criadora do primeiro compilador, citada pela Computerworld (1976)',
    source: {
      label: 'Quote Investigator',
      url: 'https://quoteinvestigator.com/2014/11/27/always-done/',
    },
    contexts: [],
  },
  {
    id: 'pichai-prevail',
    text: 'Vais vencer.',
    original: 'You will prevail.',
    author: 'Sundar Pichai',
    role: 'CEO da Google',
    source: PICHAI_2020,
    contexts: ['rejection'],
  },
  {
    id: 'jobs-time-limited',
    text: 'O teu tempo é limitado, por isso não o desperdices a viver a vida de outra pessoa.',
    original:
      'Your time is limited, so don’t waste it living someone else’s life.',
    author: 'Steve Jobs',
    role: 'Cofundador da Apple',
    source: STANFORD_2005,
    contexts: ['weekend'],
  },
  {
    id: 'page-mega-ambitious',
    text: 'Muitas vezes é mais fácil avançar em sonhos mega-ambiciosos.',
    original: 'It is often easier to make progress on mega-ambitious dreams.',
    author: 'Larry Page',
    role: 'Cofundador da Google',
    source: PAGE_MICHIGAN_2009,
    contexts: [],
  },
  {
    id: 'jobs-real-artists-ship',
    text: 'Os verdadeiros artistas entregam.',
    original: 'Real artists ship.',
    author: 'Steve Jobs',
    role: 'Cofundador da Apple, à equipa do Macintosh (1983, segundo Andy Hertzfeld)',
    source: {
      label: 'Quote Investigator',
      url: 'https://quoteinvestigator.com/2018/10/13/ship/',
    },
    contexts: [],
  },
  {
    id: 'bezos-choices',
    text: 'No fim, somos as nossas escolhas.',
    original: 'In the end, we are our choices.',
    author: 'Jeff Bezos',
    role: 'Fundador da Amazon',
    source: BEZOS_PRINCETON_2010,
    contexts: ['weekend'],
  },
  {
    id: 'zuckerberg-rowling',
    text: 'A J.K. Rowling foi rejeitada 12 vezes antes de finalmente publicar o Harry Potter.',
    original:
      'JK Rowling got rejected 12 times before she finally wrote and published Harry Potter.',
    author: 'Mark Zuckerberg',
    role: 'Fundador do Facebook',
    source: ZUCKERBERG_HARVARD_2017,
    contexts: ['rejection'],
  },
  {
    id: 'jobs-stay-hungry',
    text: 'Mantém a fome. Mantém a loucura.',
    original: 'Stay Hungry. Stay Foolish.',
    author: 'Steve Jobs',
    role: 'Cofundador da Apple',
    source: STANFORD_2005,
    contexts: ['interview'],
  },
  {
    id: 'pichai-hopeful',
    text: 'O longo arco da história diz-nos que temos todas as razões para ter esperança.',
    original:
      'The long arc of history tells us we have every reason to be hopeful.',
    author: 'Sundar Pichai',
    role: 'CEO da Google',
    source: PICHAI_2020,
    contexts: ['weekend'],
  },
  {
    id: 'bezos-kindness',
    text: 'A inteligência é um dom, a bondade é uma escolha.',
    original: 'Cleverness is a gift, kindness is a choice.',
    author: 'Jeff Bezos',
    role: 'Fundador da Amazon',
    source: BEZOS_PRINCETON_2010,
    contexts: ['weekend'],
  },
  {
    id: 'huang-unfair',
    text: 'O mundo pode ser injusto e dar-te cartas difíceis.',
    original: 'The world can be unfair and deal you with tough cards.',
    author: 'Jensen Huang',
    role: 'Fundador e CEO da NVIDIA',
    source: HUANG_CALTECH_2024,
    contexts: ['rejection'],
  },
];

/** Rótulo curto que aparece antes da frase, quando há contexto. */
export const QUOTE_CONTEXT_LABELS: Record<QuoteContext, string> = {
  rejection: 'Para depois de um «não»',
  interview: 'Para a próxima fase',
  weekend: 'Para refletir no fim de semana',
};

/**
 * O contexto do dia, por prioridade: uma rejeição recente pesa mais do que
 * uma entrevista; ao fim de semana, sem nenhuma das duas, reflexão.
 */
export function quoteContext(input: {
  today: string;
  recentRejection: boolean;
  recentInterview: boolean;
}): QuoteContext | null {
  if (input.recentRejection) return 'rejection';
  if (input.recentInterview) return 'interview';
  const wd = weekday(input.today);
  return wd === 0 || wd === 6 ? 'weekend' : null;
}

/**
 * A frase do dia: a mesma durante todo o dia, e a seguinte no dia seguinte.
 * Em cada conjunto, as frases vão rodando por ordem, por isso só se repetem
 * depois de passarem todas.
 */
export function dailyQuote(
  today: string,
  context: QuoteContext | null = null,
  quotes: readonly DailyQuote[] = DAILY_QUOTES,
): DailyQuote {
  const pool = context
    ? quotes.filter((q) => q.contexts.includes(context))
    : quotes;
  const list = pool.length ? pool : quotes;
  const day = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86_400_000);
  return list[((day % list.length) + list.length) % list.length];
}
