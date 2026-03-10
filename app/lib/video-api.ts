const BASE_URL = process.env.VIDEO_API_BASE_URL!;
const USER_ID = process.env.VIDEO_API_USER_ID!;
const PASSWORD = process.env.VIDEO_API_PASSWORD!;

export async function checkHealth(): Promise<{ apiWorking: boolean }> {
  try {
    const res = await fetch(`${BASE_URL}/media_api_working`);
    const data = await res.json();
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
  const data = await res.json();
  return {
    status: data.status,
    uniqueRequestKey: data.unique_request_key ?? '',
    description: data.description,
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
  const data = await res.json();

  if (data.error) {
    return { status: 'error', videoUrl: '', audioUrl: '', error: data.error };
  }

  return {
    status: data.status === 'complete' ? 'complete' : 'pending',
    videoUrl: data.video_url ?? '',
    audioUrl: data.audio_url ?? '',
  };
}
