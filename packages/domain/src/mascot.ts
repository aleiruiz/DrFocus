import type { Role } from '@drfocus/contracts';

/** Poses del MVP (TECH_SPEC §3). La pose sale del contexto, no de inferir emociones. */
export type MascotPose = 'bienvenida' | 'pensando' | 'senalando' | 'reorganizar' | 'celebrando';

export type MascotContext =
  | 'welcome'
  | 'today_empty'
  | 'today_next'
  | 'today_all_done'
  | 'today_overdue'
  | 'thinking'
  | 'replan'
  | 'conflict'
  | 'objective_done'
  | 'activity_done';

const MESSAGES: Record<MascotContext, { pose: MascotPose; student: string; teacher: string }> = {
  welcome: { pose: 'bienvenida', student: 'Hola, soy Doctor Focus. Vamos por un paso.', teacher: 'Hola, soy Doctor Focus. Organicemos tu semana un paso a la vez.' },
  today_empty: { pose: 'bienvenida', student: 'Nada pendiente por hoy. ¿Tienes una tarea o examen en camino?', teacher: 'Nada pendiente por hoy. ¿Tienes clases que preparar o trabajos que calificar?' },
  today_next: { pose: 'senalando', student: 'Este es tu siguiente paso. Solo este.', teacher: 'Este es tu siguiente paso. Lo demás puede esperar.' },
  today_all_done: { pose: 'celebrando', student: 'Terminaste lo de hoy. Buen trabajo.', teacher: 'Terminaste lo de hoy. Buen trabajo.' },
  today_overdue: { pose: 'reorganizar', student: 'Algunos pasos se movieron de fecha. Lo reorganizamos sin drama.', teacher: 'Algunos pasos se atrasaron. Podemos reorganizarlos.' },
  thinking: { pose: 'pensando', student: 'Estoy armando los pasos…', teacher: 'Estoy armando los pasos…' },
  replan: { pose: 'reorganizar', student: 'Acomodemos lo que falta en tu tiempo libre.', teacher: 'Acomodemos lo que falta en tu disponibilidad.' },
  conflict: { pose: 'reorganizar', student: 'No alcanza el tiempo. Elige qué ajustar.', teacher: 'No alcanza el tiempo. Elige qué ajustar.' },
  objective_done: { pose: 'celebrando', student: '¡Un paso menos!', teacher: '¡Un paso menos!' },
  activity_done: { pose: 'celebrando', student: '¡Actividad terminada! Disfruta el descanso.', teacher: '¡Actividad terminada! Disfruta el descanso.' },
};

export function mascotMessage(context: MascotContext, role: Role): { pose: MascotPose; text: string } {
  const m = MESSAGES[context];
  return { pose: m.pose, text: m[role] };
}
