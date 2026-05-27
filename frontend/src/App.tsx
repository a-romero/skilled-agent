import { KnowledgePane } from "./components/knowledge/KnowledgePane";

function App() {
  return (
    <div className="app">
      <KnowledgePane />
      <div className="pane">Middle pane placeholder</div>
      <div className="pane chat">Chat pane placeholder</div>
    </div>
  );
}

export default App;
