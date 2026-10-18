import { batches, list, num, rangeLabel, ranges, str } from './helpers.ts';
import type { ActivityTemplate, Step } from './types.ts';

const exercises: ActivityTemplate = {
  id: 'student.exercises',
  version: 1,
  role: 'student',
  name: 'Tarea o ejercicios',
  hint: 'Ejercicios, problemas, guías',
  icon: 'pencil',
  questions: [
    { id: 'subject', label: 'Materia', kind: 'text' },
    { id: 'count', label: 'Número de ejercicios', kind: 'number', suffix: 'ejercicios', min: 1, max: 300, defaultValue: 10 },
    { id: 'minutesPerItem', label: 'Minutos por ejercicio (aprox.)', kind: 'number', suffix: 'min', min: 1, max: 120, defaultValue: 6, help: 'Tu estimación; la puedes cambiar después' },
    { id: 'topics', label: 'Temas', kind: 'text', help: 'Opcional' },
  ],
  alreadyDone: [{ stepId: 'instructions', label: 'Ya revisé instrucciones y ejemplos' }],
  example: { title: 'Ejercicios de física', expectedResult: 'Hoja de ejercicios resuelta y entregada', description: 'Ejercicios 1 a 12 de la página 84.' },
  steps(a, ctx) {
    const total = num(a.count, 10, 1, 300);
    const per = num(a.minutesPerItem, 6, 1, 120);
    const lots = ranges(batches(total, per, ctx.preferredBlockMinutes));
    const steps: Step[] = [
      { id: 'instructions', title: 'Revisar instrucciones y ejemplos', expectedResult: 'Sé qué pide cada ejercicio y qué material uso', minutes: 10 },
    ];
    lots.forEach((r, i) =>
      steps.push({
        id: `block-${i + 1}`,
        title: `Resolver ejercicios ${rangeLabel(r)}`,
        expectedResult: `Ejercicios ${rangeLabel(r)} resueltos`,
        minutes: (r[1] - r[0] + 1) * per,
        after: ['instructions'],
      }),
    );
    steps.push({ id: 'check', title: 'Comprobar resultados', expectedResult: 'Resultados revisados y corregidos', minutes: 10, after: lots.map((_, i) => `block-${i + 1}`), review: true });
    steps.push({ id: 'submit', title: 'Entregar la tarea', expectedResult: 'Tarea entregada', minutes: 5, after: 'prev' });
    return steps;
  },
};

const essay: ActivityTemplate = {
  id: 'student.essay',
  version: 1,
  role: 'student',
  name: 'Ensayo o reporte',
  hint: 'Textos con extensión y fuentes',
  icon: 'file',
  questions: [
    { id: 'topic', label: 'Tema o pregunta del ensayo', kind: 'text', help: 'Déjalo vacío si todavía no lo defines' },
    { id: 'words', label: 'Extensión', kind: 'number', suffix: 'palabras', min: 100, max: 10000, defaultValue: 1200 },
    { id: 'sources', label: 'Fuentes requeridas', kind: 'number', suffix: 'fuentes', min: 0, max: 20, defaultValue: 3 },
    { id: 'citation', label: 'Formato de citas', kind: 'choice', options: ['APA', 'MLA', 'No lo indicaron'], defaultValue: 'No lo indicaron' },
  ],
  alreadyDone: [
    { stepId: 'topic', label: 'Ya tengo el tema y mi postura' },
    { stepId: 'sources', label: 'Ya reuní las fuentes' },
    { stepId: 'outline', label: 'Ya tengo el esquema' },
  ],
  example: { title: 'Ensayo argumentativo de TLR', expectedResult: 'Ensayo de 1,200 palabras entregado en la plataforma escolar', description: 'Postura clara, tres argumentos con fuentes y conclusión.' },
  steps(a) {
    const words = num(a.words, 1200, 100, 10000);
    const sources = num(a.sources, 3, 0, 20);
    const citation = str(a.citation) && a.citation !== 'No lo indicaron' ? String(a.citation) : 'el formato pedido';
    const sections = Math.max(2, Math.min(8, Math.ceil(words / 400)));
    const perSection = Math.round(words / sections);
    const steps: Step[] = [
      { id: 'requirements', title: 'Leer la rúbrica y anotar requisitos', expectedResult: 'Lista de requisitos: extensión, fuentes y formato', minutes: 10 },
      { id: 'topic', title: str(a.topic) ? 'Definir postura y tres ideas principales' : 'Elegir tema y escribir tres ideas principales', expectedResult: 'Tema y postura escritos en una frase', minutes: 20, after: 'prev' },
    ];
    if (sources > 0)
      steps.push({ id: 'sources', title: `Buscar ${sources} ${sources === 1 ? 'fuente confiable' : 'fuentes confiables'}`, expectedResult: 'Autor, año y dato clave anotados de cada fuente', minutes: 10 + sources * 8, after: 'prev' });
    steps.push({ id: 'outline', title: 'Armar el esquema', expectedResult: 'Esquema con introducción, argumentos y cierre', minutes: 20, after: 'prev' });
    for (let i = 1; i <= sections; i++) {
      const name = i === 1 ? 'la introducción' : i === sections ? 'la conclusión' : `la sección ${i}`;
      steps.push({ id: `section-${i}`, title: `Redactar ${name} (≈ ${perSection} palabras)`, expectedResult: `Borrador de ${name} escrito`, minutes: Math.max(15, Math.round(perSection / 10)), after: 'prev' });
    }
    if (sources > 0) steps.push({ id: 'references', title: `Escribir referencias en ${citation}`, expectedResult: 'Lista de referencias completa', minutes: 15, after: 'prev' });
    steps.push({ id: 'review', title: `Revisar ortografía y extensión (${words.toLocaleString('es-MX')} palabras)`, expectedResult: 'Texto revisado contra la rúbrica', minutes: 20, after: 'prev', review: true });
    steps.push({ id: 'submit', title: 'Entregar el ensayo', expectedResult: 'Ensayo entregado', minutes: 5, after: 'prev' });
    return steps;
  },
};

const exam: ActivityTemplate = {
  id: 'student.exam',
  version: 1,
  role: 'student',
  name: 'Estudiar para examen',
  hint: 'Temas, repaso y simulacro',
  icon: 'cap',
  questions: [
    { id: 'topics', label: 'Temas que entran', kind: 'textarea', help: 'Sepáralos con comas' },
    { id: 'format', label: 'Tipo de examen', kind: 'choice', options: ['Problemas', 'Opción múltiple', 'Mixto', 'No sé'], defaultValue: 'No sé' },
    { id: 'difficulty', label: '¿Cómo te sientes con los temas?', kind: 'choice', options: ['Me cuestan', 'Más o menos', 'Bastante bien'], defaultValue: 'Más o menos' },
  ],
  alreadyDone: [{ stepId: 'list', label: 'Ya tengo la lista de temas y dudas' }],
  example: { title: 'Examen de Química II', expectedResult: 'Llegar al examen con los temas repasados', description: 'Parcial 2, sin calculadora programable.' },
  steps(a) {
    const topics = str(a.topics, 'Tema 1, Tema 2')
      .split(/[,\n]/)
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 8);
    const k = a.difficulty === 'Me cuestan' ? 1.3 : a.difficulty === 'Bastante bien' ? 0.8 : 1;
    const practice = a.format === 'Opción múltiple' ? 'Contestar preguntas de práctica' : 'Resolver ejercicios';
    const steps: Step[] = [{ id: 'list', title: 'Hacer lista de temas y dudas', expectedResult: 'Temas ordenados del más difícil al más fácil', minutes: 10 }];
    topics.forEach((t, i) => {
      steps.push({ id: `review-${i + 1}`, title: `Repasar: ${t}`, expectedResult: `Resumen o mapa de ${t}`, minutes: Math.round(25 * k), after: ['list'] });
      steps.push({ id: `practice-${i + 1}`, title: `${practice} de ${t}`, expectedResult: 'Ejercicios hechos y errores marcados', minutes: Math.round(25 * k), after: 'prev' });
    });
    steps.push({ id: 'mock', title: 'Simulacro con tiempo', expectedResult: 'Simulacro resuelto y calificado', minutes: 45, after: topics.map((_, i) => `practice-${i + 1}`) });
    steps.push({ id: 'reinforce', title: 'Reforzar los errores del simulacro', expectedResult: 'Errores corregidos y entendidos', minutes: 20, after: 'prev', review: true });
    return steps;
  },
};

const project: ActivityTemplate = {
  id: 'student.project',
  version: 1,
  role: 'student',
  name: 'Proyecto o investigación',
  hint: 'Etapas y entregables',
  icon: 'flask',
  questions: [
    { id: 'deliverables', label: 'Entregables', kind: 'textarea', help: 'Por ejemplo: avance, reporte final, cartel. Sepáralos con comas' },
    { id: 'stages', label: 'Etapas que incluye', kind: 'multi', options: ['Investigar', 'Experimentar o encuestar', 'Redactar', 'Presentar'], defaultValue: ['Investigar', 'Redactar'] },
  ],
  alreadyDone: [
    { stepId: 'scope', label: 'Ya definí la pregunta y el alcance' },
    { stepId: 'research', label: 'Ya busqué antecedentes' },
  ],
  example: { title: 'Proyecto de Ciencias Sociales', expectedResult: 'Reporte de investigación con encuesta', description: 'Encuesta a 20 personas.' },
  steps(a) {
    const stages = new Set(list(a.stages).length ? list(a.stages) : ['Investigar', 'Redactar']);
    const deliverables = str(a.deliverables, 'Entrega final')
      .split(/[,\n]/)
      .map((d) => d.trim())
      .filter(Boolean)
      .slice(0, 5);
    const steps: Step[] = [{ id: 'scope', title: 'Definir pregunta y alcance', expectedResult: 'Pregunta y alcance escritos', minutes: 20 }];
    if (stages.has('Investigar')) steps.push({ id: 'research', title: 'Buscar antecedentes', expectedResult: 'Notas de al menos tres fuentes', minutes: 40, after: 'prev' });
    if (stages.has('Experimentar o encuestar')) {
      steps.push({ id: 'instrument', title: 'Preparar instrumento o experimento', expectedResult: 'Encuesta o procedimiento listo', minutes: 40, after: 'prev' });
      steps.push({ id: 'data', title: 'Aplicar y registrar datos', expectedResult: 'Datos registrados en una tabla', minutes: 60, after: 'prev' });
      steps.push({ id: 'analysis', title: 'Analizar resultados', expectedResult: 'Resultados resumidos', minutes: 40, after: 'prev' });
    }
    const base = steps[steps.length - 1]!.id;
    deliverables.forEach((d, i) => {
      steps.push({ id: `deliverable-${i + 1}`, title: stages.has('Redactar') ? `Elaborar: ${d}` : `Preparar: ${d}`, expectedResult: `${d} terminado`, minutes: 60, after: i === 0 ? [base] : [`deliverable-${i}`] });
    });
    if (stages.has('Presentar')) steps.push({ id: 'present', title: 'Preparar y ensayar la presentación', expectedResult: 'Presentación ensayada una vez', minutes: 30, after: 'prev' });
    steps.push({ id: 'validate', title: 'Revisar contra los criterios', expectedResult: 'Criterios cumplidos o pendientes anotados', minutes: 20, after: 'prev', review: true });
    steps.push({ id: 'submit', title: 'Entregar el proyecto', expectedResult: 'Proyecto entregado', minutes: 5, after: 'prev' });
    return steps;
  },
};

const lesson: ActivityTemplate = {
  id: 'teacher.lesson',
  version: 1,
  role: 'teacher',
  name: 'Preparar clase',
  hint: 'Secuencia, material y ensayo',
  icon: 'present',
  questions: [
    { id: 'topic', label: 'Tema de la clase', kind: 'text' },
    { id: 'group', label: 'Grupo y materia', kind: 'text', help: 'Por ejemplo: 2.º B, Biología I' },
    { id: 'duration', label: 'Duración de la clase', kind: 'number', suffix: 'minutos', min: 10, max: 240, defaultValue: 50 },
    { id: 'materials', label: 'Material que necesitas', kind: 'multi', options: ['Presentación', 'Hoja de trabajo', 'Práctica de laboratorio'], defaultValue: ['Presentación'] },
  ],
  alreadyDone: [{ stepId: 'objective', label: 'Ya tengo el aprendizaje esperado' }],
  example: { title: 'Preparar clase de respiración celular', expectedResult: 'Clase lista con presentación y hoja de trabajo', description: '' },
  steps(a) {
    const duration = num(a.duration, 50, 10, 240);
    const materials = list(a.materials);
    const steps: Step[] = [
      { id: 'objective', title: 'Escribir el aprendizaje esperado', expectedResult: 'Aprendizaje esperado en una frase', minutes: 10 },
      { id: 'content', title: 'Seleccionar el contenido', expectedResult: 'Lista de conceptos y ejemplos', minutes: 20, after: 'prev' },
      { id: 'activities', title: `Diseñar inicio, desarrollo y cierre (${duration} min)`, expectedResult: 'Secuencia con tiempos por momento', minutes: 25, after: 'prev' },
    ];
    const matIds: string[] = [];
    if (materials.includes('Presentación')) { steps.push({ id: 'slides', title: 'Preparar la presentación', expectedResult: 'Diapositivas listas', minutes: 35, after: ['activities'] }); matIds.push('slides'); }
    if (materials.includes('Hoja de trabajo')) { steps.push({ id: 'worksheet', title: 'Preparar la hoja de trabajo', expectedResult: 'Hoja de trabajo lista para imprimir', minutes: 25, after: ['activities'] }); matIds.push('worksheet'); }
    if (materials.includes('Práctica de laboratorio')) { steps.push({ id: 'lab', title: 'Preparar la práctica de laboratorio', expectedResult: 'Guion y lista de material', minutes: 30, after: ['activities'] }); matIds.push('lab'); }
    steps.push({ id: 'assessment', title: 'Definir cómo vas a evaluar', expectedResult: 'Pregunta o evidencia de cierre definida', minutes: 10, after: ['activities'] });
    steps.push({ id: 'timing', title: 'Revisar tiempos y ensayar la explicación', expectedResult: 'Secuencia ajustada a la duración', minutes: 15, after: [...matIds, 'assessment'], review: true });
    return steps;
  },
};

const assessment: ActivityTemplate = {
  id: 'teacher.assessment',
  version: 1,
  role: 'teacher',
  name: 'Crear examen o evaluación',
  hint: 'Reactivos y clave de respuestas',
  icon: 'clipboard',
  questions: [
    { id: 'topics', label: 'Temas que evalúa', kind: 'text' },
    { id: 'items', label: 'Número de reactivos', kind: 'number', suffix: 'reactivos', min: 1, max: 200, defaultValue: 20 },
    { id: 'kind', label: 'Tipo de reactivos', kind: 'choice', options: ['Opción múltiple', 'Abiertos', 'Mixto'], defaultValue: 'Mixto' },
    { id: 'versions', label: 'Versiones', kind: 'choice', options: ['1', '2', '3'], defaultValue: '1' },
  ],
  alreadyDone: [{ stepId: 'learning', label: 'Ya definí temas y pesos' }],
  example: { title: 'Examen parcial de Biología', expectedResult: 'Examen y clave listos para imprimir', description: '' },
  steps(a, ctx) {
    const items = num(a.items, 20, 1, 200);
    const perItem = a.kind === 'Abiertos' ? 5 : a.kind === 'Opción múltiple' ? 3 : 4;
    const versions = num(a.versions, 1, 1, 3);
    const lots = ranges(batches(items, perItem, Math.max(ctx.preferredBlockMinutes, 30)));
    const steps: Step[] = [
      { id: 'learning', title: 'Definir aprendizajes, temas y peso de cada uno', expectedResult: 'Tabla de temas con su peso', minutes: 15 },
      { id: 'structure', title: 'Definir la estructura del examen', expectedResult: 'Secciones y tipo de reactivo por sección', minutes: 10, after: 'prev' },
    ];
    lots.forEach((r, i) => steps.push({ id: `items-${i + 1}`, title: `Redactar reactivos ${rangeLabel(r)}`, expectedResult: `Reactivos ${rangeLabel(r)} escritos`, minutes: (r[1] - r[0] + 1) * perItem, after: ['structure'] }));
    const itemIds = lots.map((_, i) => `items-${i + 1}`);
    steps.push({ id: 'key', title: a.kind === 'Abiertos' ? 'Escribir la rúbrica de respuestas' : 'Hacer la clave de respuestas', expectedResult: 'Clave o rúbrica completa', minutes: 15, after: itemIds });
    if (versions > 1) steps.push({ id: 'versions', title: `Armar ${versions} versiones`, expectedResult: `${versions} versiones con su clave`, minutes: 10 * versions, after: 'prev' });
    steps.push({ id: 'review', title: 'Revisar redacción y tiempos', expectedResult: 'Examen revisado sin errores', minutes: 20, after: 'prev', review: true });
    steps.push({ id: 'final', title: 'Preparar la versión final', expectedResult: 'Examen listo para imprimir o publicar', minutes: 10, after: 'prev' });
    return steps;
  },
};

const grading: ActivityTemplate = {
  id: 'teacher.grading',
  version: 1,
  role: 'teacher',
  name: 'Calificar trabajos o exámenes',
  hint: 'Bloques de revisión y captura',
  icon: 'checksq',
  questions: [
    { id: 'count', label: 'Cantidad de trabajos', kind: 'number', suffix: 'trabajos', min: 1, max: 500, defaultValue: 40 },
    { id: 'minutesPerItem', label: 'Tiempo estimado por trabajo', kind: 'number', suffix: 'min', min: 1, max: 120, defaultValue: 8, help: 'Tu estimación; la puedes cambiar después' },
    { id: 'rubric', label: '¿Tienes rúbrica?', kind: 'choice', options: ['Sí', 'La tengo que hacer'], defaultValue: 'Sí' },
    { id: 'capture', label: '¿Hay que capturar calificaciones?', kind: 'choice', options: ['Sí, en plataforma', 'No'], defaultValue: 'Sí, en plataforma' },
  ],
  alreadyDone: [{ stepId: 'criteria', label: 'Ya revisé los criterios' }],
  example: { title: 'Calificar 40 ensayos de 5.º A', expectedResult: 'Calificaciones capturadas con comentarios breves', description: 'Rúbrica de 4 criterios.' },
  steps(a, ctx) {
    const count = num(a.count, 40, 1, 500);
    const per = num(a.minutesPerItem, 8, 1, 120);
    const lots = ranges(batches(count, per, ctx.preferredBlockMinutes));
    const steps: Step[] = [];
    if (a.rubric === 'La tengo que hacer') steps.push({ id: 'rubric', title: 'Preparar la rúbrica', expectedResult: 'Rúbrica con criterios y niveles', minutes: 25 });
    steps.push({ id: 'criteria', title: 'Revisar criterios y calificar un trabajo de muestra', expectedResult: 'Criterios claros y un ejemplo calificado', minutes: 10, after: 'prev' });
    lots.forEach((r, i) =>
      steps.push({ id: `batch-${i + 1}`, title: `Calificar trabajos ${rangeLabel(r)}`, expectedResult: `Trabajos ${rangeLabel(r)} calificados con comentario`, minutes: (r[1] - r[0] + 1) * per, after: ['criteria'] }),
    );
    const batchIds = lots.map((_, i) => `batch-${i + 1}`);
    steps.push({ id: 'verify', title: 'Verificar sumas y casos dudosos', expectedResult: 'Calificaciones verificadas', minutes: 15, after: batchIds, review: true });
    if (a.capture !== 'No') steps.push({ id: 'capture', title: 'Capturar calificaciones', expectedResult: 'Calificaciones registradas en la plataforma', minutes: 20, after: 'prev' });
    return steps;
  },
};

const material: ActivityTemplate = {
  id: 'teacher.material',
  version: 1,
  role: 'teacher',
  name: 'Preparar material didáctico',
  hint: 'Hojas, guías y recursos',
  icon: 'layers',
  questions: [
    { id: 'what', label: 'Qué material', kind: 'text', help: 'Por ejemplo: guía de 2 páginas' },
    { id: 'purpose', label: 'Propósito', kind: 'text' },
    { id: 'format', label: 'Formato', kind: 'choice', options: ['Impreso', 'Digital', 'Ambos'], defaultValue: 'Impreso' },
    { id: 'sections', label: 'Secciones o páginas', kind: 'number', suffix: 'secciones', min: 1, max: 20, defaultValue: 2 },
  ],
  alreadyDone: [{ stepId: 'purpose', label: 'Ya definí propósito y contenido' }],
  example: { title: 'Guía de estudio del parcial', expectedResult: 'Guía lista para 3 grupos', description: '' },
  steps(a) {
    const sections = num(a.sections, 2, 1, 20);
    const steps: Step[] = [
      { id: 'purpose', title: 'Definir propósito y contenido', expectedResult: 'Propósito y temas anotados', minutes: 15 },
      { id: 'structure', title: 'Organizar la estructura', expectedResult: 'Índice o boceto del material', minutes: 15, after: 'prev' },
    ];
    for (let i = 1; i <= sections; i++) steps.push({ id: `section-${i}`, title: `Elaborar la sección ${i}`, expectedResult: `Sección ${i} terminada`, minutes: 30, after: 'prev' });
    steps.push({ id: 'review', title: 'Revisar claridad y accesibilidad', expectedResult: 'Material revisado: letra legible, instrucciones claras', minutes: 15, after: 'prev', review: true });
    steps.push({ id: 'final', title: a.format === 'Digital' ? 'Publicar la versión final' : 'Imprimir o preparar la versión final', expectedResult: 'Material listo para usar', minutes: 20, after: 'prev' });
    return steps;
  },
};

export const TEMPLATES: readonly ActivityTemplate[] = [exercises, essay, exam, project, lesson, assessment, grading, material];
