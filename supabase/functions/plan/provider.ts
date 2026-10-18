import type { AgentRequest } from '../../../packages/contracts/src/index.ts';

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ProviderResult {
  /** Salida del modelo sin validar: objeto ya interpretado o el texto crudo si no era JSON. */
  output: unknown;
  usage?: ProviderUsage;
}

export interface RepairInfo {
  previousOutput: unknown;
  issues: string[];
}

/** Adaptador del modelo. La función valida todo lo que devuelve; el adaptador no decide nada del contrato. */
export interface PlanningProvider {
  readonly name: string;
  propose(request: AgentRequest, opts: { signal: AbortSignal; repair?: RepairInfo }): Promise<ProviderResult>;
}

/** Fallo del proveedor (HTTP, rechazo del modelo, presupuesto agotado). `detail` va solo a los logs. */
export class ProviderError extends Error {
  constructor(public readonly detail: string) {
    super(detail);
  }
}

/** Proveedor de demostración sin red, para probar tokens y límite antes de configurar una clave real. */
export const mockProvider: PlanningProvider = {
  name: 'mock',
  async propose(req) {
    if (req.mode === 'split' && req.targetObjective) {
      const total = Math.max(15, req.targetObjective.remainingMinutes);
      const part = Math.max(5, Math.round(total / 3 / 5) * 5);
      const last = Math.max(5, total - part * 2);
      const t = req.targetObjective.title;
      return {
        output: {
          kind: 'proposal',
          assumptions: ['Propuesta de demostración: no se usó un modelo real.'],
          warnings: [],
          questions: [],
          objectives: [
            { localId: 'a', title: `Preparar lo necesario para: ${t}`.slice(0, 120), expectedResult: 'Material y notas a la mano', estimatedMinutes: part, dependsOn: [] },
            { localId: 'b', title: `Hacer la parte principal de: ${t}`.slice(0, 120), expectedResult: 'Parte principal terminada', estimatedMinutes: part, dependsOn: ['a'] },
            { localId: 'c', title: `Revisar y cerrar: ${t}`.slice(0, 120), expectedResult: req.targetObjective.expectedResult || 'Paso terminado y revisado', estimatedMinutes: last, dependsOn: ['b'] },
          ],
        },
      };
    }
    if (req.answers.length === 0) {
      return {
        output: {
          kind: 'needs_clarification',
          assumptions: [],
          warnings: [],
          objectives: [],
          questions: [
            { id: 'deliverable', text: req.role === 'teacher' ? '¿Qué parte de esto te corresponde a ti?' : '¿Qué tienes que entregar exactamente?', options: [] },
            { id: 'progress', text: '¿Ya tienes algo avanzado?', options: ['Nada todavía', 'Ya empecé', 'Me falta poco'] },
          ],
        },
      };
    }
    return {
      output: {
        kind: 'proposal',
        assumptions: ['Propuesta de demostración: no se usó un modelo real.'],
        warnings: [],
        questions: [],
        objectives: [
          { localId: 'step-1', title: 'Anotar qué se pide y para cuándo', expectedResult: 'Lista de requisitos confirmados', estimatedMinutes: 10, dependsOn: [] },
          { localId: 'step-2', title: 'Reunir información y materiales', expectedResult: 'Notas y materiales en un solo lugar', estimatedMinutes: 25, dependsOn: ['step-1'] },
          { localId: 'step-3', title: 'Hacer la primera versión', expectedResult: 'Primera versión terminada', estimatedMinutes: 30, dependsOn: ['step-2'] },
          { localId: 'step-4', title: 'Revisar contra lo que se pide', expectedResult: 'Pendientes corregidos', estimatedMinutes: 15, dependsOn: ['step-3'] },
        ],
      },
    };
  },
};
