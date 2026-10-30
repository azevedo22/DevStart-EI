/**
 * O que se pede ao modelo. O Ollama obriga a resposta a seguir este JSON Schema,
 * mas os valores continuam a ser texto livre de uma IA: tudo é validado e
 * normalizado em cv-normalize.ts antes de chegar ao utilizador.
 */

const str = { type: ['string', 'null'] };
const int = { type: ['integer', 'null'] };

export const CV_EXTRACTION_SCHEMA = {
  type: 'object',
  properties: {
    headline: str,
    location: str,
    summary: str,
    linkedinUrl: str,
    githubUrl: str,
    portfolioUrl: str,
    education: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          institution: str,
          degree: str,
          fieldOfStudy: str,
          startYear: int,
          endYear: int,
        },
        required: ['institution', 'degree', 'startYear', 'endYear'],
      },
    },
    experience: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          organization: str,
          role: str,
          kind: {
            type: 'string',
            enum: ['JOB', 'INTERNSHIP', 'VOLUNTEER', 'OTHER'],
          },
          startDate: str,
          endDate: str,
          description: str,
        },
        required: ['organization', 'role', 'kind', 'startDate', 'endDate'],
      },
    },
    languages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          language: { type: 'string' },
          level: {
            type: 'string',
            enum: ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'NATIVE'],
          },
        },
        required: ['language', 'level'],
      },
    },
    skills: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          level: {
            type: 'string',
            enum: ['BASIC', 'INTERMEDIATE', 'ADVANCED'],
          },
        },
        required: ['name', 'level'],
      },
    },
    projects: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          technologies: { type: 'array', items: { type: 'string' } },
          repositoryUrl: str,
          liveUrl: str,
          academic: { type: 'boolean' },
          academicContext: str,
        },
        required: ['title', 'description', 'technologies', 'academic'],
      },
    },
  },
  required: [
    'headline',
    'location',
    'summary',
    'education',
    'experience',
    'languages',
    'skills',
    'projects',
  ],
} as const;

export const CV_SYSTEM_PROMPT = `És um assistente que extrai dados estruturados de currículos (CV) de recém-licenciados em informática.
Regras:
- Usa APENAS informação que está no CV. Nunca inventes dados; se algo não está no CV, usa null ou uma lista vazia.
- Responde em português de Portugal, mas mantém nomes próprios, de empresas e de tecnologias como estão no CV.
- headline: uma linha curta com o título profissional (ex.: "Desenvolvedor Full-Stack Júnior"). summary: o resumo/perfil do CV, se existir.
- Datas de experiência no formato AAAA-MM (ex.: "fev. 2025" → "2025-02"; só o ano "2024" → "2024-01"). Experiência atual → endDate null.
- kind: JOB (emprego), INTERNSHIP (estágio), VOLUNTEER (voluntariado), OTHER.
- Línguas no nível do Quadro Europeu (A1–C2) ou NATIVE para língua materna. "Fluente" → C1; "básico" → A2; "intermédio" → B1.
- skills: cada tecnologia, linguagem, framework ou ferramenta técnica em separado (não incluas soft skills).
  level: ADVANCED só se o CV indicar domínio claro ou experiência profissional prolongada; INTERMEDIATE se usada em projetos ou estágio; BASIC se só listada ou marcada como básica.
- projects: projetos pessoais ou académicos descritos no CV, com as tecnologias usadas em cada um. academic = true se for de uma unidade curricular ou do curso.
- URLs completos com https:// quando o CV os indicar.`;
