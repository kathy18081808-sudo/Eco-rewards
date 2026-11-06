import { supabase } from './supabase';

export const FACE_MACHINE_CODE = 'ECO-48FM6V';

export type FaceRequestStatus = 'pending' | 'matched' | 'failed' | 'expired';

export interface FaceRequestRow {
  id: string;
  machine_id: string;
  user_id: string;
  status: FaceRequestStatus;
  session_id: string | null;
  error: string | null;
  expires_at: string;
}

export async function countFaceSamples(userId: string) {
  const { count, error } = await supabase
    .from('face_embeddings')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('model', 'faceapi');
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function createFaceRequest(userId: string) {
  const { data: machine, error: machineError } = await supabase
    .from('machines')
    .select('id, machine_code, name')
    .eq('machine_code', FACE_MACHINE_CODE)
    .eq('is_active', true)
    .maybeSingle();
  if (machineError) throw new Error(machineError.message);
  if (!machine) throw new Error(`No hay una máquina activa ${FACE_MACHINE_CODE}.`);

  const { error: deleteError } = await supabase
    .from('face_requests')
    .delete()
    .eq('user_id', userId)
    .eq('status', 'pending');
  if (deleteError) throw new Error(deleteError.message);

  const { data, error } = await supabase
    .from('face_requests')
    .insert({ machine_id: machine.id, user_id: userId, status: 'pending' })
    .select('id, machine_id, user_id, status, session_id, error, expires_at')
    .single();
  if (error) throw new Error(error.message);
  return data as FaceRequestRow;
}
