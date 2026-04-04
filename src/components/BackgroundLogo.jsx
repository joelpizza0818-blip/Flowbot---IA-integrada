import React from 'react';
import FlowLogo from './FlowLogo';

export default function BackgroundLogo() {
  return (
    <div className="background-logo-container">
      <div className="background-logo-wrapper">
        <div className="background-logo-glow"></div>
        <FlowLogo size={280} animated={true} />
      </div>
    </div>
  );
}
