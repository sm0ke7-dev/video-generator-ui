const BASE_URL = process.env.VIDEO_API_BASE_URL!;
const USER_ID = process.env.VIDEO_API_USER_ID!;
const PASSWORD = process.env.VIDEO_API_PASSWORD!;

export async function checkHealth(): Promise<{ apiWorking: boolean }> {
  try {
    const res = await fetch(`${BASE_URL}/media_api_working`);
    const data = await res.json() as Record<string, unknown>;
    return { apiWorking: data['API Response'] === 'I Am working' };
  } catch {
    return { apiWorking: false };
  }
}

export interface SubmitJobResult {
  status: number;
  uniqueRequestKey: string;
  description?: string;
}

export async function submitJob(requestData: object): Promise<SubmitJobResult> {
  const res = await fetch(`${BASE_URL}/media_generator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: USER_ID,
      password: PASSWORD,
      method_type: 'Matrix',
      request_data: requestData,
    }),
  });
  const data = await res.json() as Record<string, unknown>;
  return {
    status: data.status as number,
    uniqueRequestKey: typeof data.unique_request_key === 'string' ? data.unique_request_key : '',
    description: typeof data.description === 'string' ? data.description : undefined,
  };
}

export interface PollStatusResult {
  status: 'pending' | 'complete' | 'error';
  videoUrl: string;
  audioUrl: string;
  error?: string;
}

export async function pollStatus(uniqueKey: string): Promise<PollStatusResult> {
  const res = await fetch(`${BASE_URL}/get_status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: USER_ID,
      password: PASSWORD,
      unique_key: uniqueKey,
    }),
  });
  const data = await res.json() as Record<string, unknown>;

  if (data.error) {
    return { status: 'error', videoUrl: '', audioUrl: '', error: typeof data.error === 'string' ? data.error : String(data.error) };
  }

  return {
    status: data.status === 'complete' ? 'complete' : 'pending',
    videoUrl: typeof data.video_url === 'string' ? data.video_url : '',
    audioUrl: typeof data.audio_url === 'string' ? data.audio_url : '',
  };
}
