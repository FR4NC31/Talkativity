import toast from "react-hot-toast"

function ChatPage() {
  return (
    <div>
      
      <button className="text-white" onClick={() => toast.success('clicked')}>Click me</button>
    </div>
  )
}

export default ChatPage
