import { PlaceholderPage } from '../../components/layout/PlaceholderPage';
import { ChatPanel } from './ChatLauncher';

/** Route "/chat" — placeholder; the chatbot agent replaces this module. */
export default function ChatPage() {
  return (
    <PlaceholderPage pageKey="chat">
      <div style={{ maxWidth: 720, minHeight: 360, display: 'flex' }} className="glass">
        <div style={{ padding: 20, flex: 1, display: 'flex' }}>
          <ChatPanel />
        </div>
      </div>
    </PlaceholderPage>
  );
}
