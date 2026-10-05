export async function getActiveAssignment(serverUrl, token) {
  try {
    const url = `${serverUrl.replace(/\/+$/, '')}/api/assignments/driver/active`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      return null;
    }

    return data.data; // Active assignment object or null
  } catch (err) {
    console.warn('[Assignment API] getActiveAssignment error:', err.message);
    return null;
  }
}

export const DEFAULT_HOME_LOCATION = {
  id: 'dest-home-001',
  name: 'Jankalyan Blood Centre (Home Base)',
  address: 'Jankalyan Blood Donation Building, Central Complex, Mumbai',
  lat: 19.0760,
  lng: 72.8777,
  radius_m: 500,
  description: 'Blood Donation Building · Manager Center & Driver Dispatch Origin',
};

export async function getHomeLocation(serverUrl, token) {
  try {
    const url = `${serverUrl.replace(/\/+$/, '')}/api/destinations/home`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok || !data.success || !data.data) {
      return DEFAULT_HOME_LOCATION;
    }

    return data.data;
  } catch (err) {
    console.warn('[Assignment API] getHomeLocation error:', err.message);
    return DEFAULT_HOME_LOCATION;
  }
}

export async function respondToAssignment(serverUrl, token, assignmentId, status, rejectionReason = null) {
  const url = `${serverUrl.replace(/\/+$/, '')}/api/assignments/${assignmentId}/status`;
  const bodyPayload = { status };
  if (rejectionReason) {
    bodyPayload.rejection_reason = rejectionReason;
  }

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(bodyPayload),
  });

  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || `Failed to update assignment to ${status}`);
  }

  return data.data;
}
