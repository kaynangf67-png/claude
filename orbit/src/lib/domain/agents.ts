import type { AgentRole } from "./types";

export interface AgentProfile {
  role: AgentRole;
  name: string;
  purpose: string;
  responsibilities: string[];
  /** What the role can actually do in the engine; kept in sync with policy/engine.ts. */
  capabilities: string[];
  restrictions: string[];
}

export const AGENTS: AgentProfile[] = [
  {
    role: "strategist",
    name: "Estrategista",
    purpose: "Interpreta o objetivo da missão e produz um plano estruturado.",
    responsibilities: ["Dividir o objetivo em tarefas", "Declarar dependências, premissas e riscos", "Propor critérios de sucesso verificáveis"],
    capabilities: ["Chamar o provedor de IA para gerar planos (saída validada por schema)", "Ver o catálogo de ferramentas permitidas"],
    restrictions: ["Não executa ferramentas", "Seus rótulos de risco e aprovação são ignorados na autorização", "Planos inválidos são rejeitados após no máximo 2 tentativas"],
  },
  {
    role: "operator",
    name: "Operador",
    purpose: "Executa tarefas aprovadas usando somente ferramentas registradas.",
    responsibilities: ["Executar a ferramenta com os parâmetros validados", "Retornar saída estruturada e evidências", "Reportar falhas com código de erro"],
    capabilities: ["Ferramentas do registro permitidas pela política e pelo papel do criador da missão"],
    restrictions: ["Sem SQL, shell, código arbitrário ou acesso a arquivos", "Ações de risco alto pausam para aprovação", "Não pode alterar permissões ou políticas"],
  },
  {
    role: "auditor",
    name: "Auditor",
    purpose: "Verifica de forma independente o resultado de cada execução.",
    responsibilities: ["Ler o registro de volta após cada escrita", "Marcar resultados como verificados, não verificados ou com falha"],
    capabilities: ["Leitura de dados internos e da API do serviço externo para conferência"],
    restrictions: ["Não executa ações de escrita", "Sem confirmação suficiente, o resultado fica como não verificado"],
  },
  {
    role: "optimizer",
    name: "Otimizador",
    purpose: "Analisa o histórico de execuções e sugere melhorias.",
    responsibilities: ["Agregar falhas, rejeições e verificações por ferramenta", "Sugerir ajustes com base nos números"],
    capabilities: ["Leitura de estatísticas agregadas", "Sugestões por regra e, se configurado, pela IA"],
    restrictions: ["Não altera políticas, permissões ou missões", "Não executa ferramentas"],
  },
];

export function getAgent(role: string): AgentProfile | undefined {
  return AGENTS.find((a) => a.role === role);
}
