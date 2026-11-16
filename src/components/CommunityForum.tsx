import React, { useState, useEffect } from 'react';
import { MessageSquare, ThumbsUp, Plus, MapPin, Send, MessageCircle } from 'lucide-react';
import { Language, Discussion, Comment } from '../types';
import { translations } from '../translations';
import { safeFetchJson } from '../utils/safeFetchJson';

interface CommunityForumProps {
  currentLang: Language;
}

export const CommunityForum: React.FC<CommunityForumProps> = ({ currentLang }) => {
  const t = translations[currentLang];

  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedPost, setSelectedPost] = useState<Discussion | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  const [showNewPostModal, setShowNewPostModal] = useState(false);
  const [author, setAuthor] = useState('');
  const [village, setVillage] = useState('');
  const [district, setDistrict] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Pest Control');
  const [crop, setCrop] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [replyAuthor, setReplyAuthor] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchDiscussions = async () => {
    setLoading(true);
    try {
      const res = await safeFetchJson<{ discussions?: Discussion[] }>('/api/discussions');
      if (res.ok && res.data) {
        setDiscussions(res.data.discussions || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      const res = await safeFetchJson<{ comments?: Comment[] }>(`/api/discussions/${postId}/comments`);
      if (res.ok && res.data) {
        setComments(res.data.comments || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDiscussions();
  }, []);

  const handleSelectPost = (post: Discussion) => {
    setSelectedPost(post);
    fetchComments(post.id);
  };

  const handleUpvote = (postId: string) => {
    setDiscussions((prev) =>
      prev.map((d) => (d.id === postId ? { ...d, upvotes: d.upvotes + 1 } : d))
    );
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPost || !commentText.trim() || !replyAuthor.trim()) return;
    setSubmittingComment(true);
    setFormError(null);
    try {
      const res = await safeFetchJson<any>(`/api/discussions/${selectedPost.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: replyAuthor.trim(),
          role: 'Farmer / Member',
          content: commentText.trim(),
        }),
      });
      const data = res.data;
      if (res.ok && data?.success) {
        setCommentText('');
        fetchComments(selectedPost.id);
        fetchDiscussions();
      } else {
        setFormError(data?.error || 'Could not post comment.');
      }
    } catch (e) {
      console.error(e);
      setFormError('Network error while posting comment.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!author.trim() || !village.trim() || !district.trim() || !title.trim() || !content.trim()) {
      setFormError('Please fill in your name, village, district, title, and details.');
      return;
    }
    setSubmittingPost(true);
    setFormError(null);
    try {
      const res = await safeFetchJson<any>('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: author.trim(),
          village: village.trim(),
          district: district.trim(),
          title: title.trim(),
          content: content.trim(),
          category,
          crop: crop.trim() || undefined,
        }),
      });
      const data = res.data;
      if (res.ok && data?.success) {
        setShowNewPostModal(false);
        setTitle('');
        setContent('');
        fetchDiscussions();
      } else {
        setFormError(data?.error || 'Could not publish discussion topic.');
      }
    } catch (e) {
      console.error(e);
      setFormError('Network error while publishing topic.');
    } finally {
      setSubmittingPost(false);
    }
  };

  const categories = ['All', 'Pest Control', 'Crop Selection', 'Market Trends', 'Government Schemes'];

  const filtered = discussions.filter((d) => {
    if (activeCategory === 'All') return true;
    return d.category === activeCategory;
  });

  return (
    <div className="space-y-6 pb-8">
      {/* Header & Category Filters */}
      <div className="glass-panel rounded-[24px] p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[#4D966B] tracking-wide">
              Peer Agricultural Network
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#202820] font-display mt-1">
              {t.communityTitle}
            </h2>
            <p className="text-sm text-[#5D665E] mt-1 max-w-2xl">{t.communitySub}</p>
          </div>

          <button
            type="button"
            onClick={() => setShowNewPostModal(true)}
            className="px-4 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white rounded-[14px] text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer shadow-sm self-start sm:self-auto whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Ask or Share Topic</span>
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap items-center gap-1.5 mt-7 pt-5 border-t border-[#174C36]/10">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-[12px] transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeCategory === cat
                  ? 'bg-[#174C36] text-white shadow-2xs'
                  : 'bg-white/65 text-[#5D665E] hover:bg-white hover:text-[#202820]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Forum Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Posts List */}
        <div className="lg:col-span-7 space-y-4">
          {loading ? (
            [1, 2, 3].map((k) => <div key={k} className="h-36 rounded-[22px] skeleton-glass" />)
          ) : filtered.length === 0 ? (
            <div className="glass-panel rounded-[22px] p-8 text-center text-xs text-[#858D86]">
              {discussions.length === 0
                ? 'No community discussions yet. Start a topic above.'
                : 'No community topics in this category yet.'}
            </div>
          ) : (
            filtered.map((post) => (
              <div
                key={post.id}
                onClick={() => handleSelectPost(post)}
                className={`glass-panel rounded-[22px] p-6 transition-all cursor-pointer ${
                  selectedPost?.id === post.id
                    ? 'ring-2 ring-[#174C36] bg-white/90'
                    : 'hover:bg-white/85'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5D665E]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#202820]">{post.author}</span>
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#4D966B]" />
                      <span>
                        {post.village}, {post.district}
                      </span>
                    </span>
                  </div>
                  <span className="text-[#174C36] font-semibold">{post.category}</span>
                </div>

                <h3 className="text-base font-bold text-[#202820] font-display mt-2 leading-snug">
                  {currentLang === 'te' && post.titleTe ? post.titleTe : post.title}
                </h3>

                <p className="text-xs text-[#5D665E] mt-2 line-clamp-2 leading-relaxed">
                  {currentLang === 'te' && post.contentTe ? post.contentTe : post.content}
                </p>

                <div className="mt-4 pt-3 border-t border-[#174C36]/10 flex items-center justify-between text-xs text-[#5D665E]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpvote(post.id);
                    }}
                    className="flex items-center gap-1.5 text-[#202820] hover:text-[#174C36] font-semibold cursor-pointer"
                  >
                    <ThumbsUp className="w-4 h-4 text-[#4D966B]" />
                    <span className="font-mono tabular-nums">{post.upvotes} Helpful Votes</span>
                  </button>

                  <div className="flex items-center gap-1.5 text-[#5D665E] font-medium">
                    <MessageSquare className="w-4 h-4" />
                    <span className="font-mono tabular-nums">
                      {post.commentsCount} Farmer Responses
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Selected Post Thread */}
        <div className="lg:col-span-5">
          {selectedPost ? (
            <div className="glass-panel rounded-[22px] p-6 sticky top-20 text-xs flex flex-col max-h-[80vh]">
              <div className="border-b border-[#174C36]/10 pb-4">
                <div className="flex items-center justify-between text-[#858D86]">
                  <span>Discussion Details</span>
                  <span className="font-semibold text-[#174C36]">{selectedPost.category}</span>
                </div>
                <h4 className="text-base font-bold text-[#202820] font-display mt-1">
                  {currentLang === 'te' && selectedPost.titleTe
                    ? selectedPost.titleTe
                    : selectedPost.title}
                </h4>
                <p className="text-[#5D665E] mt-2 leading-relaxed">
                  {currentLang === 'te' && selectedPost.contentTe
                    ? selectedPost.contentTe
                    : selectedPost.content}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
                {comments.length === 0 ? (
                  <div className="text-center py-8 text-[#858D86]">
                    No replies yet. Be the first farmer or agronomist to respond!
                  </div>
                ) : (
                  comments.map((c) => (
                    <div key={c.id} className="p-3.5 bg-white/65 rounded-[14px] space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-bold text-[#202820]">{c.author}</span>
                        <span className="text-[#4D966B] font-semibold">{c.role}</span>
                      </div>
                      <div className="text-[#5D665E] leading-relaxed text-xs">{c.content}</div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="pt-3 border-t border-[#174C36]/10 space-y-2">
                {formError && (
                  <div className="text-[11px] text-red-700 font-medium">{formError}</div>
                )}
                <input
                  type="text"
                  required
                  placeholder="Your name..."
                  value={replyAuthor}
                  onChange={(e) => setReplyAuthor(e.target.value)}
                  className="w-full bg-white/75 border border-[#174C36]/15 rounded-[12px] px-3 py-1.5 text-xs font-medium text-[#202820] focus:bg-white focus:outline-[#174C36]"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Share your practical experience..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="flex-1 bg-white/75 border border-[#174C36]/15 rounded-[12px] px-3 py-2 text-xs font-medium text-[#202820] focus:bg-white focus:outline-[#174C36]"
                  />
                  <button
                    type="submit"
                    disabled={submittingComment || !commentText.trim() || !replyAuthor.trim()}
                    className="px-3.5 py-2 bg-[#174C36] hover:bg-[#113A29] text-white rounded-[12px] text-xs font-semibold cursor-pointer disabled:opacity-40"
                    aria-label="Send reply"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="glass-panel rounded-[22px] p-8 text-center text-[#858D86] text-xs">
              <MessageCircle className="w-10 h-10 mx-auto text-[#4D966B]/60 mb-2" />
              <div className="font-semibold text-[#202820]">Select any discussion thread</div>
              <p className="mt-1">
                View advice from fellow farmers and regional agricultural extension officers.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Post Modal */}
      {showNewPostModal && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel-elevated rounded-[26px] max-w-lg w-full p-6 sm:p-8 text-xs">
            <h3 className="text-lg font-bold text-[#202820] font-display">
              Create Farmer Community Topic
            </h3>
            <p className="text-xs text-[#5D665E] mt-0.5 mb-6">
              Ask for pest advice, crop recommendations, or share pricing feedback.
            </p>

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div>
                <label className="block font-semibold text-[#202820] mb-1">Your Name</label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-medium text-[#202820]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">Village</label>
                  <input
                    type="text"
                    required
                    value={village}
                    onChange={(e) => setVillage(e.target.value)}
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-medium text-[#202820]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">District</label>
                  <input
                    type="text"
                    required
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-medium text-[#202820]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-medium text-[#202820]"
                  >
                    <option value="Pest Control">Pest Control (తెగుళ్ల నివారణ)</option>
                    <option value="Crop Selection">Crop Selection (పంట ఎంపిక)</option>
                    <option value="Market Trends">Market Trends (మార్కెట్ ధరలు)</option>
                    <option value="Government Schemes">Government Schemes (రైతు పథకాలు)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-[#202820] mb-1">Crop (Optional)</label>
                  <input
                    type="text"
                    value={crop}
                    onChange={(e) => setCrop(e.target.value)}
                    placeholder="e.g. Chilli, Paddy, Cotton"
                    className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-medium text-[#202820]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#202820] mb-1">Title / Question</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. How to prevent root rot in heavy black soil?"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-medium text-[#202820]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#202820] mb-1">
                  Details & Observations
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Describe your soil condition, days since sowing, or symptoms observed..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full bg-white/80 border border-[#174C36]/15 rounded-[12px] p-2.5 font-medium text-[#202820]"
                />
              </div>

              {formError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-800 font-medium">
                  {formError}
                </div>
              )}

              <div className="pt-4 border-t border-[#174C36]/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowNewPostModal(false)}
                  className="px-4 py-2 text-[#5D665E] hover:text-[#202820] font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPost}
                  className="px-5 py-2.5 bg-[#174C36] hover:bg-[#113A29] text-white font-semibold rounded-[12px] cursor-pointer disabled:opacity-50"
                >
                  {submittingPost ? 'Publishing...' : 'Publish to Forum'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
