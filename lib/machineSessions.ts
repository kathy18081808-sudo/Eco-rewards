import { supabase } from './supabase';

export interface ArmedSessionResponse {
  session_id: string;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  expires_at: string;
  account_number: string | null;
  display_name: string;
}

export function machineQrPayload(machineCode: string) {
  return `ecorewards://machine/${machineCode}`;
}

export function parseMachineCode(value: string) {
  const rawValue = value.trim();
  if (!rawValue) return null;

  try {
    const url = new URL(rawValue);
    if (url.protocol === 'ecorewards:' && url.hostname === 'machine') {
      return normalizeMachineCode(url.pathname.replace('/', ''));
    }
  } catch {
    // Plain machine codes are accepted for manual testing and admin workflows.
  }

  if (/^ECO-[A-Z0-9]{6}$/i.test(rawValue)) {
    return normalizeMachineCode(rawValue);
  }

  return null;
}

export async function armMachineSession(machineCode: string) {
  const normalizedMachineCode = normalizeMachineCode(machineCode);

  const { data, error } = await supabase.functions.invoke<ArmedSessionResponse>(
    'arm-session',
    {
      body: { machine_code: normalizedMachineCode },
    }
  );

  if (error) {
    const errorDetails = await getFunctionErrorDetails(error);

    const responseError =
      typeof errorDetails.body === 'object' &&
      errorDetails.body !== null &&
      'error' in errorDetails.body &&
      typeof (errorDetails.body as { error?: unknown }).error === 'string'
        ? (errorDetails.body as { error: string }).error
        : null;

    throw new Error(responseError || error.message);
  }

  if (!data?.session_id) {
    throw new Error('The machine could not be armed.');
  }

  return data;
}

function normalizeMachineCode(machineCode: string) {
  return machineCode.trim().toUpperCase();
}

async function getFunctionErrorDetails(error: any) {
  const status = error?.context?.status ?? error?.status ?? null;

  try {
    const body = error?.context ? await error.context.clone().json() : null;
    return { status, body };
  } catch {
    try {
      const body = error?.context ? await error.context.clone().text() : null;
      return { status, body };
    } catch {
      return { status, body: null };
    }
  }
}
