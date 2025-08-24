import React from 'react';

export default function Home() {
  return (
    <main style={{ padding: 24, fontFamily: 'sans-serif' }}>
      <h1>SF-1</h1>
      <p>Welcome to SF-1. Backend on :4000, frontend on :3000.</p>
      <ul>
        <li><a href="/health">Frontend Health</a></li>
      </ul>
    </main>
  );
}
