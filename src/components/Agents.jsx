import React, { useState } from 'react';
import './Agents.css';

export default function Agents() {
  const [activeAgent, setActiveAgent] = useState(0);

  const agents = [
    {
      name: 'Flow Chat',
      description: 'Natural language processing with deep context awareness'
    },
    {
      name: 'Task Automator',
      description: 'Workflow automation and intelligent scheduling'
    },
    {
      name: 'Data Guard',
      description: 'Real-time security monitoring and compliance'
    },
    {
      name: 'Smart Router',
      description: 'Intelligent message routing and load distribution'
    }
  ];

  return (
    <section className="agents">
      <div className="agents-container">
        <div className="section-header">
          <h2>Intelligent Agents</h2>
          <p>Powered by advanced MCP technology</p>
        </div>

        <div className="agents-showcase">
          <div className="agents-selector">
            {agents.map((agent, index) => (
              <button
                key={index}
                className={`agent-tab ${activeAgent === index ? 'active' : ''}`}
                onClick={() => setActiveAgent(index)}
              >
                <span className="tab-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="tab-name">{agent.name}</span>
              </button>
            ))}
          </div>

          <div className="agent-content">
            <div className="content-inner">
              <h3>{agents[activeAgent].name}</h3>
              <p>{agents[activeAgent].description}</p>
              <button className="explore-btn">Explore →</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
