import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message || 'অপ্রত্যাশিত ত্রুটি ঘটেছে' };
  }

  componentDidCatch(error: Error) {
    console.error('Taskeen ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#EEF3F0] text-[#0F1A17] flex items-center justify-center p-6">
          <div className="bg-white border border-[#DCE3E0] rounded-2xl p-6 max-w-md w-full text-center space-y-4 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-[#0E5A45] text-white mx-auto flex items-center justify-center font-bold text-xl">
              !
            </div>
            <h2 className="font-serif-bn font-bold text-xl">দুঃখিত, একটি সমস্যা হয়েছে</h2>
            <p className="text-xs opacity-75 break-words">{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 rounded-xl bg-[#0E5A45] text-white text-xs font-semibold"
            >
              পুনরায় লোড করুন
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
