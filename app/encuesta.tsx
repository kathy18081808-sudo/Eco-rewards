import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { Colors, Spacing, BorderRadius, FontSize } from '../constants/theme';

type Option = { value: string; label: string };

const AGE: Option[] = [
  { value: 'menos_18', label: 'Menos de 18' },
  { value: '18_24', label: '18–24' },
  { value: '25_34', label: '25–34' },
  { value: '35_49', label: '35–49' },
  { value: '50_mas', label: '50 o más' },
];
const OCCUPATION: Option[] = [
  { value: 'estudiante', label: 'Estudiante' },
  { value: 'docente', label: 'Docente' },
  { value: 'trabajador', label: 'Trabajador/a' },
  { value: 'otro', label: 'Otro' },
];
const FREQUENCY: Option[] = [
  { value: 'nunca', label: 'Nunca' },
  { value: 'a_veces', label: 'A veces' },
  { value: 'seguido', label: 'Seguido' },
  { value: 'siempre', label: 'Siempre' },
];
const ID_METHOD: Option[] = [
  { value: 'face', label: 'Reconocimiento facial' },
  { value: 'qr', label: 'Código QR' },
  { value: 'pin', label: 'PIN en el teclado' },
];
const DETECTION: Option[] = [
  { value: 'yes', label: 'Sí' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'No estoy seguro/a' },
];
const PLACES: Option[] = [
  { value: 'universidad', label: 'Universidad' },
  { value: 'supermercado', label: 'Supermercado' },
  { value: 'centro_comercial', label: 'Centro comercial' },
  { value: 'parque', label: 'Parque' },
  { value: 'oficina', label: 'Oficina' },
  { value: 'colonia', label: 'Mi colonia' },
];
const REWARDS: Option[] = [
  { value: 'comida', label: 'Comida' },
  { value: 'cafe', label: 'Café' },
  { value: 'descuentos', label: 'Descuentos' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'saldo', label: 'Saldo de celular' },
  { value: 'donacion', label: 'Donación ambiental' },
];

interface Answers {
  age_range: string | null;
  occupation: string | null;
  recycling_frequency: string | null;
  used_machine: boolean | null;
  id_method: string | null;
  ease_register: number | null;
  ease_identify: number | null;
  ease_deposit: number | null;
  instructions_clarity: number | null;
  detection_correct: string | null;
  app_ease: number | null;
  face_comfort: number | null;
  motivation: number | null;
  nps: number | null;
  preferred_places: string[];
  preferred_rewards: string[];
  liked: string;
  improve: string;
  problems: string;
  consent: boolean;
}

const EMPTY: Answers = {
  age_range: null,
  occupation: null,
  recycling_frequency: null,
  used_machine: null,
  id_method: null,
  ease_register: null,
  ease_identify: null,
  ease_deposit: null,
  instructions_clarity: null,
  detection_correct: null,
  app_ease: null,
  face_comfort: null,
  motivation: null,
  nps: null,
  preferred_places: [],
  preferred_rewards: [],
  liked: '',
  improve: '',
  problems: '',
  consent: false,
};

// Preguntas obligatorias para poder enviar
const REQUIRED: (keyof Answers)[] = [
  'age_range',
  'recycling_frequency',
  'used_machine',
  'app_ease',
  'motivation',
  'nps',
];

export default function SurveyScreen() {
  const router = useRouter();
  const { user, session } = useAuth();
  const [a, setA] = useState<Answers>(EMPTY);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const set = <K extends keyof Answers>(key: K, value: Answers[K]) =>
    setA((prev) => ({ ...prev, [key]: value }));

  const toggle = (key: 'preferred_places' | 'preferred_rewards', value: string) =>
    setA((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((v) => v !== value) : [...prev[key], value],
    }));

  const answered = REQUIRED.filter((k) => a[k] !== null).length;

  const submit = async () => {
    const missing = REQUIRED.filter((k) => a[k] === null);
    if (missing.length) {
      Alert.alert('Faltan respuestas', 'Responde las preguntas marcadas con *.');
      return;
    }
    if (!a.consent) {
      Alert.alert('Consentimiento', 'Marca la casilla de consentimiento para enviar.');
      return;
    }
    setSending(true);
    const { error } = await supabase.from('survey_responses').insert({
      ...a,
      // Si no usó la máquina, no guardamos respuestas de la máquina
      ...(a.used_machine === false && {
        id_method: null,
        ease_identify: null,
        ease_deposit: null,
        instructions_clarity: null,
        detection_correct: null,
        face_comfort: null,
      }),
      liked: a.liked.trim() || null,
      improve: a.improve.trim() || null,
      problems: a.problems.trim() || null,
      profile_id: user?.id ?? null,
    });
    setSending(false);
    if (error) {
      Alert.alert('No se pudo enviar', error.message);
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <View style={[styles.container, styles.center]}>
        <View style={styles.thanksIcon}>
          <Ionicons name="leaf" size={48} color={Colors.surface} />
        </View>
        <Text style={styles.thanksTitle}>¡Gracias por tu opinión!</Text>
        <Text style={styles.thanksText}>Nos ayuda a mejorar EcoRewards.</Text>
        <TouchableOpacity
          style={[styles.button, { alignSelf: 'stretch', marginTop: Spacing.xl }]}
          onPress={() => router.replace(session ? '/(tabs)' : '/(auth)/login')}
        >
          <Text style={styles.buttonText}>{session ? 'Volver a la app' : 'Crear mi cuenta EcoRewards'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.linkButton}
          onPress={() => {
            setA(EMPTY);
            setSent(false);
          }}
        >
          <Text style={styles.linkText}>Enviar otra respuesta</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Ionicons name="clipboard-outline" size={32} color={Colors.surface} />
        </View>
        <Text style={styles.title}>Evalúa EcoRewards</Text>
        <Text style={styles.subtitle}>
          Son 3 minutos. Tus respuestas son anónimas y se usan solo para mejorar el prototipo.
        </Text>
        <Text style={styles.progress}>
          {answered} de {REQUIRED.length} preguntas obligatorias
        </Text>
      </View>

      <Section title="Sobre ti">
        <Question label="Edad *">
          <Choices options={AGE} value={a.age_range} onChange={(v) => set('age_range', v)} />
        </Question>
        <Question label="Ocupación">
          <Choices options={OCCUPATION} value={a.occupation} onChange={(v) => set('occupation', v)} />
        </Question>
        <Question label="¿Con qué frecuencia reciclas? *">
          <Choices
            options={FREQUENCY}
            value={a.recycling_frequency}
            onChange={(v) => set('recycling_frequency', v)}
          />
        </Question>
      </Section>

      <Section title="La máquina">
        <Question label="¿Usaste la máquina EcoRewards? *">
          <Choices
            options={[
              { value: 'yes', label: 'Sí' },
              { value: 'no', label: 'No, solo la app' },
            ]}
            value={a.used_machine === null ? null : a.used_machine ? 'yes' : 'no'}
            onChange={(v) => set('used_machine', v === 'yes')}
          />
        </Question>

        {a.used_machine && (
          <>
            <Question label="¿Cómo te identificaste en la máquina?">
              <Choices options={ID_METHOD} value={a.id_method} onChange={(v) => set('id_method', v)} />
            </Question>
            <Question label="¿Qué tan fácil fue identificarte?">
              <Scale value={a.ease_identify} onChange={(v) => set('ease_identify', v)} />
            </Question>
            <Question label="¿Qué tan fácil fue depositar tu botella o lata?">
              <Scale value={a.ease_deposit} onChange={(v) => set('ease_deposit', v)} />
            </Question>
            <Question label="¿Las instrucciones de la máquina fueron claras?">
              <Scale value={a.instructions_clarity} onChange={(v) => set('instructions_clarity', v)} />
            </Question>
            <Question label="¿La máquina reconoció bien tu material?">
              <Choices
                options={DETECTION}
                value={a.detection_correct}
                onChange={(v) => set('detection_correct', v)}
              />
            </Question>
            <Question label="¿Qué tan cómodo/a te sientes usando reconocimiento facial?">
              <Scale value={a.face_comfort} onChange={(v) => set('face_comfort', v)} />
            </Question>
          </>
        )}
      </Section>

      <Section title="La app">
        <Question label="¿Qué tan fácil fue registrarte?">
          <Scale value={a.ease_register} onChange={(v) => set('ease_register', v)} />
        </Question>
        <Question label="¿Qué tan fácil es usar la app (puntos, ranking, premios)? *">
          <Scale value={a.app_ease} onChange={(v) => set('app_ease', v)} />
        </Question>
      </Section>

      <Section title="Tu opinión">
        <Question label="¿Reciclarías más si ganas premios por hacerlo? *">
          <Scale
            value={a.motivation}
            onChange={(v) => set('motivation', v)}
            low="Nada"
            high="Mucho más"
          />
        </Question>
        <Question label="Del 0 al 10, ¿qué tan probable es que recomiendes EcoRewards a un amigo? *">
          <Nps value={a.nps} onChange={(v) => set('nps', v)} />
        </Question>
        <Question label="¿Dónde te gustaría encontrar una máquina? (puedes elegir varias)">
          <MultiChoices
            options={PLACES}
            values={a.preferred_places}
            onToggle={(v) => toggle('preferred_places', v)}
          />
        </Question>
        <Question label="¿Qué premios te motivarían más? (puedes elegir varios)">
          <MultiChoices
            options={REWARDS}
            values={a.preferred_rewards}
            onToggle={(v) => toggle('preferred_rewards', v)}
          />
        </Question>
        <Question label="¿Qué fue lo que más te gustó?">
          <Field value={a.liked} onChange={(v) => set('liked', v)} />
        </Question>
        <Question label="¿Qué mejorarías?">
          <Field value={a.improve} onChange={(v) => set('improve', v)} />
        </Question>
        <Question label="¿Tuviste algún problema o error?">
          <Field value={a.problems} onChange={(v) => set('problems', v)} />
        </Question>
      </Section>

      <TouchableOpacity style={styles.consent} onPress={() => set('consent', !a.consent)}>
        <Ionicons
          name={a.consent ? 'checkbox' : 'square-outline'}
          size={24}
          color={a.consent ? Colors.primary : Colors.textSecondary}
        />
        <Text style={styles.consentText}>
          Acepto que mis respuestas se usen de forma anónima para evaluar este proyecto académico. *
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, sending && { opacity: 0.7 }]}
        onPress={submit}
        disabled={sending}
      >
        {sending ? <ActivityIndicator color={Colors.surface} /> : <Text style={styles.buttonText}>Enviar</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Question({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.question}>
      <Text style={styles.questionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Choices({
  options,
  value,
  onChange,
}: {
  options: Option[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => (
        <TouchableOpacity
          key={o.value}
          style={[styles.chip, value === o.value && styles.chipActive]}
          onPress={() => onChange(o.value)}
        >
          <Text style={[styles.chipText, value === o.value && styles.chipTextActive]}>{o.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function MultiChoices({
  options,
  values,
  onToggle,
}: {
  options: Option[];
  values: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = values.includes(o.value);
        return (
          <TouchableOpacity
            key={o.value}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onToggle(o.value)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>
              {active ? '✓ ' : ''}
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Scale({
  value,
  onChange,
  low = 'Muy difícil',
  high = 'Muy fácil',
}: {
  value: number | null;
  onChange: (v: number) => void;
  low?: string;
  high?: string;
}) {
  return (
    <View>
      <View style={styles.scaleRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.scaleItem, value === n && styles.chipActive]}
            onPress={() => onChange(n)}
          >
            <Text style={[styles.scaleText, value === n && styles.chipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabel}>{low}</Text>
        <Text style={styles.scaleLabel}>{high}</Text>
      </View>
    </View>
  );
}

function Nps({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <View>
      <View style={styles.npsRow}>
        {Array.from({ length: 11 }, (_, n) => (
          <TouchableOpacity
            key={n}
            style={[styles.npsItem, value === n && styles.chipActive]}
            onPress={() => onChange(n)}
          >
            <Text style={[styles.npsText, value === n && styles.chipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.scaleLabels}>
        <Text style={styles.scaleLabel}>Nada probable</Text>
        <Text style={styles.scaleLabel}>Muy probable</Text>
      </View>
    </View>
  );
}

function Field({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      style={styles.field}
      value={value}
      onChangeText={onChange}
      placeholder="Escribe aquí (opcional)"
      placeholderTextColor={Colors.textLight}
      multiline
      maxLength={500}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxl, maxWidth: 640, width: '100%', alignSelf: 'center' },
  center: { justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  header: { alignItems: 'center', marginBottom: Spacing.lg, marginTop: Spacing.md },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  title: { fontSize: FontSize.xxl, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  subtitle: { fontSize: FontSize.md, color: Colors.textSecondary, textAlign: 'center', marginTop: Spacing.sm },
  progress: { fontSize: FontSize.sm, color: Colors.primaryDark, marginTop: Spacing.sm, fontWeight: '600' },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.primaryDark, marginBottom: Spacing.sm },
  question: { marginTop: Spacing.md },
  questionLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginBottom: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.text },
  chipTextActive: { color: Colors.surface, fontWeight: '700' },
  scaleRow: { flexDirection: 'row', gap: Spacing.sm },
  scaleItem: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scaleText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  scaleLabel: { fontSize: FontSize.xs, color: Colors.textSecondary },
  npsRow: { flexDirection: 'row', gap: 4 },
  npsItem: {
    flex: 1,
    height: 40,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  npsText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  field: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
    textAlignVertical: 'top',
  },
  consent: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start', marginVertical: Spacing.md },
  consentText: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { color: Colors.surface, fontSize: FontSize.lg, fontWeight: '700' },
  thanksIcon: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  thanksTitle: { fontSize: 26, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  thanksText: { fontSize: FontSize.md, color: Colors.textSecondary, marginTop: Spacing.sm, textAlign: 'center' },
  linkButton: { marginTop: Spacing.md, padding: Spacing.sm },
  linkText: { color: Colors.primary, fontWeight: '700' },
});
