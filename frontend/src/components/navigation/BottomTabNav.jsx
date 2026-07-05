import { MessageSquareIcon, UsersIcon } from "lucide-react";

const tabs = [
  { id: "chats", label: "Chats", icon: MessageSquareIcon },
  { id: "users", label: "People", icon: UsersIcon },
];

export function BottomTabNav({ activeTab, onTabChange }) {
  return (
    <nav className="flex shrink-0 items-center justify-around border-t border-border bg-background pb-1 pt-1.5">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-0.5 text-[11px] font-medium transition-colors ${
              isActive ? "text-primary" : "text-muted"
            }`}
          >
            <Icon className={`size-[22px] ${isActive ? "fill-primary/15" : ""}`} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
