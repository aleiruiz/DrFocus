import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors, radius, space } from '@drfocus/design-tokens';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { fmtLocal } from '@/lib/format';
import { T } from './ui';

const pad = (n: number) => String(n).padStart(2, '0');
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fmtDateLabel(date: string) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const js = new Date(y, m - 1, d);
  return `${DIAS[js.getDay()]} ${d} de ${MESES[m - 1]} de ${y}`;
}

/** Campo de fecha (aaaa-mm-dd) con el selector nativo de Android. */
export function DateField({ label, value, onChange, minimumDate }: { label: string; value: string | null; onChange: (v: string) => void; minimumDate?: Date }) {
  const [open, setOpen] = useState(false);
  const current = value ? new Date(`${value}T12:00:00`) : new Date();
  return (
    <View style={{ gap: 6 }}>
      <T v="bodyBold">{label}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? fmtDateLabel(value) : 'sin elegir'}`} onPress={() => setOpen(true)} style={box}>
        <T color={value ? colors.ink : colors.ink3}>{value ? fmtDateLabel(value) : 'Elegir fecha'}</T>
      </Pressable>
      {open && (
        <DateTimePicker
          value={current}
          mode="date"
          minimumDate={minimumDate}
          onChange={(e: DateTimePickerEvent, d?: Date) => {
            setOpen(false);
            if (e.type === 'set' && d) onChange(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
          }}
        />
      )}
    </View>
  );
}

/** Campo de hora (HH:mm). Sin hora no se acepta un plan (TECH_SPEC §6). */
export function TimeField({ label, value, onChange }: { label: string; value: string | null; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [h, m] = (value ?? '12:00').split(':').map(Number) as [number, number];
  const current = new Date();
  current.setHours(h, m, 0, 0);
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <T v="bodyBold">{label}</T>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value ? fmtLocal(value) : 'sin elegir'}`} onPress={() => setOpen(true)} style={box}>
        <T color={value ? colors.ink : colors.ink3}>{value ? fmtLocal(value) : 'Elegir hora'}</T>
      </Pressable>
      {open && (
        <DateTimePicker
          value={current}
          mode="time"
          is24Hour={false}
          onChange={(e: DateTimePickerEvent, d?: Date) => {
            setOpen(false);
            if (e.type === 'set' && d) onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
          }}
        />
      )}
    </View>
  );
}

const box = { minHeight: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.card, paddingHorizontal: space.md, justifyContent: 'center' as const };
