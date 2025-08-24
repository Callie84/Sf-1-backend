import React from 'react';

export default function Health() {
  return (
    <pre>{JSON.stringify({ status: 'ok' }, null, 2)}</pre>
  );
}
