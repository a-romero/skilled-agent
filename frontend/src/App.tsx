import { KnowledgePane } from "./components/knowledge/KnowledgePane";
import { ChatPane } from "./components/chat/ChatPane";

function App() {
  return (
    <div className="app">
      <KnowledgePane />
      <div className="pane">Middle pane placeholder</div>
      <ChatPane userName="User" />
    </div>
  );
}

export default App;
