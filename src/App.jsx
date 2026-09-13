import { useEffect, useMemo, useState } from 'react';
import Cropper from 'react-easy-crop';
import { cardsData, countryOptions, pathOptions } from './data/content';
import { supabase } from './lib/supabase';
import './App.css';

const STORAGE_KEYS = {
  user: 'movein-user',
  submissions: 'movein-submissions',
  savedGuides: 'movein-saved-guides'
};

const STORAGE_BUCKET = 'community-media';

function createCroppedImage(imageSrc, pixelCrop) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const context = canvas.getContext('2d');
      context.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
      );
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Could not prepare the cropped image.'));
        }
      }, 'image/jpeg', 0.9);
    };
    image.onerror = reject;
    image.src = imageSrc;
  });
}

const normalizeCard = (card, fallbackId = '') => {
  const cardId = card.id ?? `${card.title ?? 'guide'}-${card.author ?? 'member'}-${fallbackId}`;
  return {
    ...card,
    id: cardId,
    tag: card.tag ?? 'COMMUNITY · GUIDE',
    title: card.title ?? 'Untitled guide',
    meta: card.meta ?? 'Community guide',
    quote: card.quote ?? 'Helpful local guidance.',
    author: card.author ?? 'Community member',
    role: card.role ?? 'community member',
    rating: card.rating ?? '★ 5.0',
    status: card.status ?? 'approved'
  };
};

const mapContributionToCard = (row) => normalizeCard({
  id: row.id,
  createdBy: row.created_by,
  status: row.status,
  type: row.category,
  tag: `${(row.category || 'community').toUpperCase()} · ${row.source === 'video' ? 'VIDEO' : 'GUIDE'}`,
  title: row.title,
  meta: row.meta || `${row.city || 'Vilnius'} · community guide`,
  quote: row.quote || `“${row.details || 'Helpful local guidance.'}”`,
  author: row.author || 'Community member',
  role: row.created_by ? 'verified contributor' : 'community member',
  rating: row.rating || '★ 5.0',
  search: `${row.city || 'vilnius'} ${row.category || 'community'} ${row.title || 'experience'}`,
  videoUrl: row.media_url || row.video_url || null,
  mediaType: row.media_type || (row.media_url ? (row.media_url.match(/\.(mp4|mov|webm|ogg|m4v)$/i) ? 'video' : 'image') : 'video')
}, row.id);

function App() {
  const [selectedCountry, setSelectedCountry] = useState('Lithuania');
  const [selectedPath, setSelectedPath] = useState('Student');
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCountryPage, setShowCountryPage] = useState(false);
  const [showProfilePage, setShowProfilePage] = useState(false);
  const [showAdminPage, setShowAdminPage] = useState(false);
  const [showNotificationsPage, setShowNotificationsPage] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [postLikeCount, setPostLikeCount] = useState(0);
  const [hasLikedPost, setHasLikedPost] = useState(false);
  const [postComments, setPostComments] = useState([]);
  const [commentProfiles, setCommentProfiles] = useState({});
  const [mentionProfiles, setMentionProfiles] = useState([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [commentText, setCommentText] = useState('');
  const [commentNotice, setCommentNotice] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showContributorModal, setShowContributorModal] = useState(false);
  const [editingContribution, setEditingContribution] = useState(null);
  const [authMode, setAuthMode] = useState('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [selectedMediaFile, setSelectedMediaFile] = useState(null);
  const [submissionNotice, setSubmissionNotice] = useState({ type: '', message: '' });
  const [currentUser, setCurrentUser] = useState(null);
  const [profile, setProfile] = useState({ displayName: '', city: '', bio: '' });
  const [profileAvatarFile, setProfileAvatarFile] = useState(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState('');
  const [profileCrop, setProfileCrop] = useState({ x: 0, y: 0 });
  const [profileZoom, setProfileZoom] = useState(1);
  const [profileCroppedAreaPixels, setProfileCroppedAreaPixels] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileNotice, setProfileNotice] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [adminProfiles, setAdminProfiles] = useState([]);
  const [adminContributions, setAdminContributions] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [submissionForm, setSubmissionForm] = useState({
    name: '',
    title: '',
    city: '',
    category: 'housing',
    details: '',
    videoName: '',
    videoUrl: ''
  });
  const [contentItems, setContentItems] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.submissions);
    return stored ? JSON.parse(stored).map((card) => normalizeCard(card)) : cardsData.map((card) => normalizeCard(card));
  });
  const [savedGuides, setSavedGuides] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEYS.savedGuides);
    return stored ? JSON.parse(stored) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.submissions, JSON.stringify(contentItems));
  }, [contentItems]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.savedGuides, JSON.stringify(savedGuides));
  }, [savedGuides]);

  useEffect(() => {
    const syncViewFromLocation = () => {
      const view = window.location.hash;
      setShowCountryPage(view === '#explore' || view === '#profile' || view === '#admin' || view === '#notifications' || view.startsWith('#post/'));
      setShowProfilePage(view === '#profile');
      setShowAdminPage(view === '#admin');
      setShowNotificationsPage(view === '#notifications');
      setSelectedPostId(view.startsWith('#post/') ? decodeURIComponent(view.slice(6)) : null);
    };

    syncViewFromLocation();
    window.addEventListener('hashchange', syncViewFromLocation);
    window.addEventListener('popstate', syncViewFromLocation);

    return () => {
      window.removeEventListener('hashchange', syncViewFromLocation);
      window.removeEventListener('popstate', syncViewFromLocation);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (submissionForm.videoUrl) {
        URL.revokeObjectURL(submissionForm.videoUrl);
      }
    };
  }, [submissionForm.videoUrl]);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let isMounted = true;

    const syncSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (isMounted) {
        setCurrentUser(session?.user ?? null);
      }
    };

    syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setCurrentUser(session?.user ?? null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!supabase || !currentUser) {
      return undefined;
    }

    let isMounted = true;

    const loadProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, city, bio, avatar_url, is_admin')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (isMounted) {
        setProfile({
          displayName: data?.display_name || currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || '',
          city: data?.city || '',
          bio: data?.bio || '',
          avatarUrl: data?.avatar_url || '',
          isAdmin: data?.is_admin === true
        });
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [currentUser]);

  useEffect(() => {
    if (!supabase) {
      return undefined;
    }

    let isMounted = true;

    const loadContributions = async () => {
      const { data, error } = await supabase
        .from('contributions')
        .select('*')
        .order('created_at', { ascending: false });

      if (isMounted && !error && Array.isArray(data)) {
        const dbCards = data.map((row) => mapContributionToCard(row));
        setContentItems((prev) => {
          const merged = [...dbCards, ...prev.filter((card) => !dbCards.some((item) => item.id === card.id))];
          return merged.map((card) => normalizeCard(card));
        });
      }
    };

    loadContributions();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredCards = useMemo(() => {
    return contentItems.filter((card) => {
      const isVisible = card.status === 'approved'
        || (card.status === 'pending' && card.createdBy === currentUser?.id);
      const matchesFilter = activeFilter === 'all' || card.type === activeFilter;
      const searchText = `${card.search ?? ''} ${card.title ?? ''} ${card.meta ?? ''} ${card.quote ?? ''} ${card.author ?? ''} ${card.role ?? ''}`.toLowerCase();
      const matchesQuery = !searchQuery || searchText.includes(searchQuery.toLowerCase());
      return isVisible && matchesFilter && matchesQuery;
    });
  }, [activeFilter, contentItems, currentUser, searchQuery]);

  const myContributionCards = useMemo(() => {
    if (!currentUser) {
      return [];
    }

    return contentItems.filter((card) => card.createdBy === currentUser.id);
  }, [contentItems, currentUser]);

  const selectedPost = contentItems.find((card) => String(card.id) === String(selectedPostId));

  const continueLabel = selectedCountry === 'Lithuania' ? 'Explore Lithuania' : 'Continue';

  function handleContinue() {
    if (selectedCountry === 'Lithuania') {
      window.location.hash = '#explore';
      setShowCountryPage(true);
      return;
    }

    alert(`${selectedCountry} is coming soon. Lithuania is available right now.`);
  }

  function openAdminPage() {
    window.location.hash = '#admin';
    setShowCountryPage(true);
    setShowAdminPage(true);
    setShowProfilePage(false);
  }

  function openPostPage(cardId) {
    window.history.pushState({}, '', `#post/${encodeURIComponent(cardId)}`);
    setShowCountryPage(true);
    setShowProfilePage(false);
    setShowAdminPage(false);
    setSelectedPostId(String(cardId));
  }

  useEffect(() => {
    if (!supabase || !currentUser || !profile.isAdmin) {
      return undefined;
    }

    let isMounted = true;

    const loadAdminData = async () => {
      setAdminLoading(true);
      const [{ data: profilesData }, { data: contributionsData }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, city, is_admin, updated_at').order('updated_at', { ascending: false }),
        supabase.from('contributions').select('*').order('created_at', { ascending: false })
      ]);

      if (isMounted) {
        setAdminProfiles(Array.isArray(profilesData) ? profilesData : []);
        setAdminContributions(Array.isArray(contributionsData) ? contributionsData : []);
        setAdminLoading(false);
      }
    };

    loadAdminData();

    return () => {
      isMounted = false;
    };
  }, [currentUser, profile.isAdmin]);

  useEffect(() => {
    if (!supabase || !selectedPostId) {
      return undefined;
    }

    let isMounted = true;

    const loadInteractions = async () => {
      const [{ data: likes }, { data: comments }] = await Promise.all([
        supabase.from('post_likes').select('user_id').eq('contribution_id', selectedPostId),
        supabase.from('post_comments').select('id, user_id, body, created_at').eq('contribution_id', selectedPostId).order('created_at', { ascending: true })
      ]);

      if (isMounted) {
        setPostLikeCount(likes?.length || 0);
        setHasLikedPost(Boolean(currentUser && likes?.some((like) => like.user_id === currentUser.id)));
        const commentRows = comments || [];
        setPostComments(commentRows);

        const userIds = [...new Set(commentRows.map((comment) => comment.user_id))];
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, display_name, avatar_url')
            .in('id', userIds);
          setCommentProfiles(Object.fromEntries((profiles || []).map((commentProfile) => [commentProfile.id, commentProfile])));
        }
      }
    };

    loadInteractions();

    return () => {
      isMounted = false;
    };
  }, [currentUser, selectedPostId]);

  useEffect(() => {
    if (!supabase || !currentUser) {
      return undefined;
    }

    supabase.from('profiles').select('id, display_name, avatar_url').then(({ data }) => {
      setMentionProfiles(data || []);
    });

    return undefined;
  }, [currentUser]);

  useEffect(() => {
    if (!supabase || !currentUser) {
      return undefined;
    }

    let isMounted = true;
    const loadNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, message, contribution_id, read_at, created_at')
        .order('created_at', { ascending: false });
      if (isMounted) {
        setNotifications(data || []);
      }
    };

    loadNotifications();
    return () => { isMounted = false; };
  }, [currentUser]);

  function handleReset() {
    setSelectedCountry('Lithuania');
    setSelectedPath('Student');
  }

  async function handleLogin(event) {
    event.preventDefault();

    if (!supabase) {
      setAuthError('Add your Supabase keys to .env.local before continuing.');
      return;
    }

    const email = loginForm.email.trim();
    const password = loginForm.password.trim();

    if (!email || !password) {
      setAuthError('Please enter both email and password.');
      return;
    }

    setAuthError('');
    setAuthLoading(true);

    try {
      if (authMode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          throw error;
        }

        setAuthMode('login');
        setAuthError('Check your email to confirm your account, then sign in.');
        setLoginForm({ email: '', password: '' });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      setShowLoginModal(false);
      setLoginForm({ email: '', password: '' });
      setAuthError('');
    } catch (error) {
      setAuthError(error.message || 'Authentication failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setCurrentUser(null);
  }

  async function handleGoogleLogin() {
    if (!supabase) {
      setAuthError('Add your Supabase keys to .env.local before continuing.');
      return;
    }

    setAuthError('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });

    if (error) {
      setAuthError(error.message || 'Google login failed. Please try again.');
    }
  }

  const userDisplayName = currentUser ? (profile.displayName || currentUser.email?.split('@')[0] || 'Member') : '';

  async function handleSaveProfile(event) {
    event.preventDefault();
    if (!supabase || !currentUser) {
      return;
    }

    setProfileLoading(true);
    setProfileNotice('');

    let avatarUrl = profile.avatarUrl || '';

    if (profileAvatarFile && profileAvatarPreview && profileCroppedAreaPixels) {
      const croppedBlob = await createCroppedImage(profileAvatarPreview, profileCroppedAreaPixels);
      const croppedFile = new File([croppedBlob], 'profile-avatar.jpg', { type: 'image/jpeg' });
      const filePath = `${currentUser.id}/avatar-${Date.now()}.jpg`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(filePath, croppedFile, { upsert: false, cacheControl: '3600', contentType: 'image/jpeg' });

      if (uploadError) {
        setProfileNotice(uploadError.message || 'Could not upload your profile picture.');
        setProfileLoading(false);
        return;
      }

      avatarUrl = supabase.storage.from('profile-avatars').getPublicUrl(uploadData.path).data.publicUrl;
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: currentUser.id,
        display_name: profile.displayName.trim(),
        city: profile.city.trim(),
        bio: profile.bio.trim(),
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      });

    if (error) {
      setProfileNotice(error.message || 'Could not save your profile.');
    } else {
      setProfile({ ...profile, avatarUrl });
      setProfileAvatarFile(null);
      setProfileAvatarPreview('');
      setProfileNotice('Profile saved.');
      setShowProfileModal(false);
    }

    setProfileLoading(false);
  }

  function handleProfileAvatarChange(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (profileAvatarPreview) {
      URL.revokeObjectURL(profileAvatarPreview);
    }

    setProfileAvatarFile(file);
    setProfileAvatarPreview(URL.createObjectURL(file));
    setProfileCrop({ x: 0, y: 0 });
    setProfileZoom(1);
    setProfileCroppedAreaPixels(null);
  }

  function handleSaveGuide(cardId) {
    setSavedGuides((prev) => {
      if (prev.includes(cardId)) {
        return prev.filter((id) => id !== cardId);
      }

      return [...prev, cardId];
    });
  }

  async function handleToggleLike() {
    if (!currentUser || !supabase || !selectedPostId) {
      setCommentNotice('Please log in to like posts.');
      setShowLoginModal(true);
      return;
    }

    if (hasLikedPost) {
      const { error } = await supabase.from('post_likes').delete()
        .eq('contribution_id', selectedPostId).eq('user_id', currentUser.id);
      if (!error) {
        setHasLikedPost(false);
        setPostLikeCount((count) => Math.max(0, count - 1));
      }
      return;
    }

    const { error } = await supabase.from('post_likes').insert({
      contribution_id: selectedPostId,
      user_id: currentUser.id
    });
    if (!error) {
      setHasLikedPost(true);
      setPostLikeCount((count) => count + 1);
    }
  }

  async function handleSubmitComment(event) {
    event.preventDefault();
    if (!currentUser || !supabase || !selectedPostId) {
      setCommentNotice('Please log in to comment.');
      setShowLoginModal(true);
      return;
    }

    const body = commentText.trim();
    if (!body) {
      setCommentNotice('Write a comment before posting.');
      return;
    }

    const mentionedUserIds = mentionProfiles
      .filter((mentionProfile) => new RegExp(`(^|\\s)@${mentionProfile.display_name?.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}(?=\\s|$)`, 'i').test(body))
      .map((mentionProfile) => mentionProfile.id);

    const { data, error } = await supabase.from('post_comments').insert({
      contribution_id: selectedPostId,
      user_id: currentUser.id,
      body,
      mentioned_user_ids: mentionedUserIds
    }).select('id, user_id, body, created_at').single();

    if (error) {
      setCommentNotice(error.message || 'Could not add comment.');
      return;
    }

    setPostComments((comments) => [...comments, data]);
    setCommentProfiles((profiles) => ({
      ...profiles,
      [currentUser.id]: { id: currentUser.id, display_name: userDisplayName, avatar_url: profile.avatarUrl }
    }));
    setCommentText('');
    setCommentNotice('');
  }

  function handleCommentTextChange(event) {
    const nextText = event.target.value;
    setCommentText(nextText);
    const mentionMatch = nextText.match(/(?:^|\s)@([\w.-]*)$/);
    setMentionQuery(mentionMatch ? mentionMatch[1].toLowerCase() : '');
  }

  function insertMention(mentionProfile) {
    const mentionName = mentionProfile.display_name || 'member';
    setCommentText((text) => text.replace(/(?:^|\s)@[\w.-]*$/, (match) => `${match.startsWith(' ') ? ' ' : ''}@${mentionName} `));
    setMentionQuery('');
  }

  async function handleDeleteContribution(card) {
    if (!currentUser || !supabase || !window.confirm(`Delete "${card.title}"?`)) {
      return;
    }

    setSubmissionNotice({ type: '', message: '' });

    const { error } = await supabase
      .from('contributions')
      .delete()
      .eq('id', card.id)
      .eq('created_by', currentUser.id);

    if (error) {
      setSubmissionNotice({
        type: 'error',
        message: `Could not delete your post: ${error.message}`
      });
      return;
    }

    if (card.videoUrl) {
      const storageMarker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
      const storageIndex = card.videoUrl.indexOf(storageMarker);

      if (storageIndex !== -1) {
        const storagePath = decodeURIComponent(card.videoUrl.slice(storageIndex + storageMarker.length));
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      }
    }

    setContentItems((prev) => prev.filter((item) => item.id !== card.id));
    setSavedGuides((prev) => prev.filter((id) => id !== card.id));
    setSubmissionNotice({ type: 'success', message: 'Your post was deleted.' });
  }

  async function handleAdminDeleteContribution(row) {
    if (!currentUser || !profile.isAdmin || !supabase || !window.confirm(`Delete "${row.title}"?`)) {
      return;
    }

    const { error } = await supabase.from('contributions').delete().eq('id', row.id);
    if (error) {
      setSubmissionNotice({ type: 'error', message: `Admin deletion failed: ${error.message}` });
      return;
    }

    setAdminContributions((prev) => prev.filter((item) => item.id !== row.id));
    setContentItems((prev) => prev.filter((item) => item.id !== row.id));
    setSubmissionNotice({ type: 'success', message: 'Post removed by admin.' });
  }

  async function handleModerateContribution(row, status) {
    if (!currentUser || !profile.isAdmin || !supabase) {
      return;
    }

    const { error } = await supabase
      .from('contributions')
      .update({ status })
      .eq('id', row.id);

    if (error) {
      setSubmissionNotice({ type: 'error', message: `Moderation failed: ${error.message}` });
      return;
    }

    setAdminContributions((prev) => prev.map((item) => (
      item.id === row.id ? { ...item, status } : item
    )));
    setContentItems((prev) => prev.map((item) => (
      item.id === row.id ? { ...item, status } : item
    )));
    setSubmissionNotice({ type: 'success', message: `Post marked ${status}.` });
  }

  function handleMediaUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedMediaFile(null);
      setSubmissionForm((prev) => ({ ...prev, videoName: '', videoUrl: '' }));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedMediaFile(file);
    setSubmissionForm((prev) => ({
      ...prev,
      videoName: file.name,
      videoUrl: objectUrl
    }));
  }

  function handleEditContribution(card) {
    setEditingContribution(card);
    setSubmissionNotice({ type: '', message: '' });
    setSubmissionForm({
      name: card.author,
      title: card.title,
      city: card.meta?.split(' · ')[0] || 'Vilnius',
      category: card.type || 'community',
      details: card.quote?.replace(/^“|”$/g, '') || '',
      videoName: '',
      videoUrl: ''
    });
    setShowContributorModal(true);
  }

  async function handleSubmitContribution(event) {
    event.preventDefault();
    setSubmissionNotice({ type: '', message: '' });

    if (supabase && !currentUser) {
      setSubmissionNotice({
        type: 'error',
        message: 'Please log in before submitting a contribution.'
      });
      setShowContributorModal(false);
      setShowLoginModal(true);
      return;
    }

    const authorName = submissionForm.name || userDisplayName || 'Community member';
    const hasVideo = Boolean(submissionForm.videoName);
    const newContribution = {
      type: submissionForm.category,
      category: submissionForm.category,
      tag: hasVideo ? 'VIDEO · STORY' : `${submissionForm.category.toUpperCase()} · GUIDE`,
      title: submissionForm.title || 'New contributor story',
      city: submissionForm.city || 'Vilnius',
      details: submissionForm.details || 'Here is my honest experience from living here.',
      author: authorName,
      role: currentUser ? 'verified contributor' : 'community member',
      rating: '★ 5.0',
      search: `${submissionForm.city || 'vilnius'} ${submissionForm.category || 'community'} ${submissionForm.title || 'experience'}`,
      videoName: submissionForm.videoName,
      source: hasVideo ? 'video' : 'guide'
    };

    try {
      if (editingContribution && supabase) {
        const { data, error } = await supabase
          .from('contributions')
          .update({
            author: authorName,
            title: newContribution.title,
            city: newContribution.city,
            category: newContribution.category,
            details: newContribution.details,
            quote: `“${newContribution.details}”`,
            meta: `${newContribution.city} · community guide`
          })
          .eq('id', editingContribution.id)
          .eq('created_by', currentUser.id)
          .select();

        if (error) {
          throw error;
        }

        const updatedRow = data?.[0];
        const updatedCard = normalizeCard({
          ...editingContribution,
          ...(updatedRow ? mapContributionToCard(updatedRow) : {}),
          id: editingContribution.id,
          createdBy: currentUser.id,
          type: newContribution.category,
          tag: editingContribution.tag,
          title: newContribution.title,
          meta: `${newContribution.city} · community guide`,
          quote: `“${newContribution.details}”`,
          author: authorName,
          search: `${newContribution.city} ${newContribution.category} ${newContribution.title}`
        });

        setContentItems((prev) => prev.map((card) => (
          card.id === updatedCard.id ? updatedCard : card
        )));

        setSubmissionNotice({ type: 'success', message: 'Your post was updated.' });
        setEditingContribution(null);
        setShowContributorModal(false);
        return;
      }

      let mediaUrl = null;
      let mediaType = null;

      if (supabase) {
        setIsUploadingMedia(true);
      }

      if (selectedMediaFile && supabase) {
        const file = selectedMediaFile;
        const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(`user-posts/${currentUser.id}/${fileName}`, file, { cacheControl: '3600', upsert: false });

        if (uploadError) {
          throw uploadError;
        }

        const publicUrlData = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(uploadData.path);
        mediaUrl = publicUrlData.data.publicUrl;
        mediaType = file.type.startsWith('video') ? 'video' : 'image';
      }

      if (supabase) {
        const { data, error } = await supabase
          .from('contributions')
          .insert([{
            author: authorName,
            title: newContribution.title,
            city: newContribution.city,
            category: newContribution.category,
            details: newContribution.details,
            source: newContribution.source,
            status: 'pending',
            rating: newContribution.rating,
            quote: `“${newContribution.details}”`,
            meta: hasVideo ? `${newContribution.city} · video story · ${newContribution.videoName}` : `${newContribution.city} · community guide`,
            media_url: mediaUrl,
            media_type: mediaType,
            created_by: currentUser?.id ?? null
          }])
          .select();

        if (error) {
          throw error;
        }

        if (data && data[0]) {
          const insertedCard = mapContributionToCard(data[0]);
          setContentItems((prev) => [insertedCard, ...prev.filter((card) => card.id !== insertedCard.id)]);
        }
      } else {
        const localCard = normalizeCard({
          type: newContribution.type,
          tag: newContribution.tag,
          title: newContribution.title,
          meta: `${newContribution.city} · community guide`,
          quote: `“${newContribution.details}”`,
          author: newContribution.author,
          role: newContribution.role,
          rating: newContribution.rating,
          search: newContribution.search,
          videoUrl: submissionForm.videoUrl,
          mediaType: submissionForm.videoUrl ? 'video' : 'image'
        }, `local-${Date.now()}`);

        setContentItems((prev) => [localCard, ...prev]);
      }

      setSubmissionNotice({
        type: 'success',
        message: 'Your post was uploaded successfully.'
      });
      setShowContributorModal(false);
      setSubmissionForm({
        name: '',
        title: '',
        city: '',
        category: 'housing',
        details: '',
        videoName: '',
        videoUrl: ''
      });
      setSelectedMediaFile(null);
      setEditingContribution(null);
    } catch (error) {
      const errorMessage = error?.message || '';
      const isStorageError = errorMessage.includes('storage') || errorMessage.includes('bucket');
      setSubmissionNotice({
        type: 'error',
        message: isStorageError
          ? `Media upload failed: ${errorMessage}. Check the community-media storage INSERT policy.`
          : `Post creation failed: ${errorMessage || 'check the contributions table INSERT policy.'}`
      });
    } finally {
      setIsUploadingMedia(false);
    }
  }

  const loginModal = showLoginModal && (
    <div className="modal-backdrop" onClick={() => setShowLoginModal(false)}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h3>
          <button type="button" className="close-btn" onClick={() => setShowLoginModal(false)}>×</button>
        </div>

        <div className="auth-mode-toggle" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={authMode === 'login' ? 'mode-btn active' : 'mode-btn'}
            onClick={() => setAuthMode('login')}
          >
            Log in
          </button>
          <button
            type="button"
            className={authMode === 'signup' ? 'mode-btn active' : 'mode-btn'}
            onClick={() => setAuthMode('signup')}
          >
            Sign up
          </button>
        </div>

        {!supabase && (
          <p className="auth-warning">
            Supabase is not configured yet. Add your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY values to a .env.local file.
          </p>
        )}

        {authError && <p className="auth-error">{authError}</p>}

        <form className="auth-form" onSubmit={handleLogin}>
          <label>
            Email
            <input
              type="email"
              value={loginForm.email}
              onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
              placeholder="••••••••"
              required
            />
          </label>
          <button type="submit" className="primary-btn full-width" disabled={authLoading}>
            {authLoading ? 'Please wait...' : authMode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="auth-divider"><span>or</span></div>
        <button type="button" className="google-btn full-width" onClick={handleGoogleLogin}>
          Continue with Google
        </button>
      </div>
    </div>
  );

  const profilePage = (
    <section className="profile-page" aria-labelledby="profile-page-title">
      <div className="profile-page-header">
        <div>
          <div className="badge">YOUR PROFILE</div>
          <h1 id="profile-page-title">Your MoveIn profile</h1>
          <p>Keep your identity and community story up to date.</p>
        </div>
        <button type="button" className="outline" onClick={() => {
          window.location.hash = '#explore';
          setShowProfilePage(false);
        }}>Back to Explore</button>
      </div>

      <div className="profile-page-grid">
        <section className="profile-detail-card">
          {profile.avatarUrl ? (
            <img className="profile-page-avatar" src={profile.avatarUrl} alt={`${userDisplayName} profile`} />
          ) : (
            <div className="profile-page-avatar profile-page-avatar-fallback">{userDisplayName.charAt(0).toUpperCase()}</div>
          )}
          <h2>{userDisplayName}</h2>
          <p>{currentUser?.email}</p>
          {profile.city && <p>{profile.city}</p>}
          {profile.bio ? <p className="profile-bio">{profile.bio}</p> : <p className="empty-state">Add a short bio to introduce yourself.</p>}
          <button type="button" className="primary-btn" onClick={() => {
            setProfileNotice('');
            setShowProfileModal(true);
          }}>Edit profile</button>
        </section>

        <section className="profile-contributions-card">
          <div className="saved-header">
            <h2>Your contributions</h2>
            <span>{myContributionCards.length} published</span>
          </div>
          {myContributionCards.length > 0 ? (
            <ul className="saved-list">
              {myContributionCards.map((card) => (
                <li key={card.id}>
                  <div>
                    <strong>{card.title}</strong>
                    <small>{card.meta} · {card.status}</small>
                  </div>
                  <div className="post-actions">
                    <button type="button" className="edit-btn" onClick={() => handleEditContribution(card)}>Edit</button>
                    <button type="button" className="delete-btn" onClick={() => handleDeleteContribution(card)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty-state">Your published stories will appear here.</p>
          )}
        </section>
      </div>
    </section>
  );

  const postPage = selectedPost ? (
    <section className="post-page" aria-labelledby="post-page-title">
      <button type="button" className="back-link" onClick={() => window.history.back()}>← Back</button>
      <div className="post-detail">
        <div className="post-detail-media">
          {selectedPost.videoUrl ? (
            selectedPost.mediaType === 'video'
              ? <video src={selectedPost.videoUrl} controls playsInline />
              : <img src={selectedPost.videoUrl} alt={selectedPost.title} />
          ) : <div className="post-detail-placeholder">MoveIn story</div>}
        </div>
        <div className="post-detail-content">
          <div className="badge">{selectedPost.tag}</div>
          <h1 id="post-page-title">{selectedPost.title}</h1>
          <div className="meta">{selectedPost.meta}</div>
          <p className="post-detail-quote">{selectedPost.quote}</p>
          <div className="post-detail-author">
            <div className="avatar">{selectedPost.author.charAt(0)}</div>
            <div><strong>{selectedPost.author}</strong><small>{selectedPost.role}</small></div>
          </div>
          <div className="post-actions detail-actions">
            <button type="button" className={savedGuides.includes(String(selectedPost.id)) ? 'save-btn saved' : 'save-btn'} onClick={() => handleSaveGuide(String(selectedPost.id))}>
              {savedGuides.includes(String(selectedPost.id)) ? 'Favorited' : 'Add to favorites'}
            </button>
            <button type="button" className={hasLikedPost ? 'like-btn liked' : 'like-btn'} onClick={handleToggleLike}>
              {hasLikedPost ? 'Liked' : 'Like'} · {postLikeCount}
            </button>
          </div>
        </div>
      </div>

      <section className="comments-panel">
        <h2>Comments</h2>
        {postComments.length > 0 ? postComments.map((comment) => {
          const authorProfile = commentProfiles[comment.user_id];
          return (
          <div className="comment" key={comment.id}>
            {authorProfile?.avatar_url ? <img className="comment-avatar" src={authorProfile.avatar_url} alt="" /> : <div className="comment-avatar comment-avatar-fallback">{(authorProfile?.display_name || 'M').charAt(0).toUpperCase()}</div>}
            <div><strong>{authorProfile?.display_name || 'Community member'}</strong><p>{comment.body}</p></div>
          </div>
          );
        }) : <p className="empty-state">Be the first to comment.</p>}
        <form className="comment-form" onSubmit={handleSubmitComment}>
          <div className="comment-input-wrap">
            <textarea value={commentText} onChange={handleCommentTextChange} placeholder="Share a helpful thought... Use @ to mention someone." rows="3" />
            {mentionQuery && (
              <div className="mention-suggestions">
                {mentionProfiles
                  .filter((mentionProfile) => (mentionProfile.display_name || '').toLowerCase().includes(mentionQuery))
                  .slice(0, 5)
                  .map((mentionProfile) => (
                    <button type="button" key={mentionProfile.id} onClick={() => insertMention(mentionProfile)}>
                      {mentionProfile.display_name || 'Community member'}
                    </button>
                  ))}
              </div>
            )}
          </div>
          <button type="submit" className="primary-btn">Post comment</button>
        </form>
        {commentNotice && <p className="submission-error">{commentNotice}</p>}
      </section>
    </section>
  ) : <section className="post-page"><p className="empty-state">This post could not be found.</p></section>;

  const adminPage = (
    <section className="admin-page" aria-labelledby="admin-page-title">
      <div className="profile-page-header">
        <div>
          <div className="badge">ADMIN</div>
          <h1 id="admin-page-title">Manage MoveIn</h1>
          <p>Review members and community contributions.</p>
        </div>
        <button type="button" className="outline" onClick={() => {
          window.location.hash = '#explore';
          setShowAdminPage(false);
        }}>Back to Explore</button>
      </div>

      {adminLoading ? <p className="empty-state">Loading admin data...</p> : (
        <div className="admin-grid">
          <section className="admin-panel">
            <div className="saved-header">
              <h2>Users</h2>
              <span>{adminProfiles.length}</span>
            </div>
            <ul className="admin-list">
              {adminProfiles.map((adminProfile) => (
                <li key={adminProfile.id}>
                  <div>
                    <strong>{adminProfile.display_name || 'Unnamed member'}</strong>
                    <small>{adminProfile.city || 'No city added'}</small>
                  </div>
                  {adminProfile.is_admin && <span className="admin-label">Admin</span>}
                </li>
              ))}
            </ul>
          </section>

          <section className="admin-panel">
            <div className="saved-header">
              <h2>Posts</h2>
              <span>{adminContributions.length}</span>
            </div>
            <ul className="admin-list">
              {adminContributions.map((contribution) => (
                <li key={contribution.id}>
                  <div>
                    <strong>{contribution.title}</strong>
                    <small>{contribution.author} · {contribution.city} · {contribution.status}</small>
                  </div>
                  <div className="post-actions">
                    {contribution.status !== 'approved' && (
                      <button type="button" className="edit-btn" onClick={() => handleModerateContribution(contribution, 'approved')}>Approve</button>
                    )}
                    {contribution.status !== 'hidden' && (
                      <button type="button" className="edit-btn" onClick={() => handleModerateContribution(contribution, 'hidden')}>Hide</button>
                    )}
                    <button type="button" className="delete-btn" onClick={() => handleAdminDeleteContribution(contribution)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </section>
  );

  const notificationsPage = (
    <section className="profile-page" aria-labelledby="notifications-page-title">
      <div className="profile-page-header">
        <div>
          <div className="badge">ACTIVITY</div>
          <h1 id="notifications-page-title">Notifications</h1>
          <p>Updates about your posts and community conversations.</p>
        </div>
        <button type="button" className="outline" onClick={() => {
          window.location.hash = '#explore';
          setShowNotificationsPage(false);
        }}>Back to Explore</button>
      </div>
      <section className="notifications-panel">
        {notifications.length > 0 ? notifications.map((notification) => (
          <button
            type="button"
            className={notification.read_at ? 'notification read' : 'notification'}
            key={notification.id}
            onClick={async () => {
              if (!notification.read_at && supabase) {
                await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notification.id);
                setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item));
              }
              if (notification.contribution_id) openPostPage(notification.contribution_id);
            }}
          >
            <strong>{notification.message}</strong>
            <small>{new Date(notification.created_at).toLocaleString()}</small>
          </button>
        )) : <p className="empty-state">No notifications yet.</p>}
      </section>
    </section>
  );

  return !showCountryPage ? (
    <div className="landing">
      <div className="landing-card">
        <div className="landing-topbar">
          <div className="eyebrow">MoveIn</div>
          <button type="button" className="ghost-btn inline-btn" onClick={() => setShowLoginModal(true)}>
            {currentUser ? `Hi, ${userDisplayName}` : 'Log in'}
          </button>
        </div>
        <h1>Start your next chapter.</h1>
        <p>Choose the country you want to explore and the path that fits your move.</p>

        <div className="selector-block">
          <div className="selector-label">Choose a country</div>
          <div className="country-grid">
            {countryOptions.map((country) => (
              <button
                key={country}
                type="button"
                className={`choice ${selectedCountry === country ? 'selected' : ''}`}
                onClick={() => setSelectedCountry(country)}
              >
                {country}
              </button>
            ))}
          </div>
        </div>

        <div className="selector-block">
          <div className="selector-label">What brings you?</div>
          <div className="path-grid">
            {pathOptions.map((path) => (
              <button
                key={path}
                type="button"
                className={`choice ${selectedPath === path ? 'selected' : ''}`}
                onClick={() => setSelectedPath(path)}
              >
                {path}
              </button>
            ))}
          </div>
        </div>

        <div className="landing-actions">
          <button type="button" className="ghost-btn" onClick={handleReset}>Reset</button>
          <button type="button" className="primary-btn" onClick={handleContinue}>
            {continueLabel}
          </button>
        </div>
      </div>

      {loginModal}
    </div>
  ) : (
    <div className="page-shell">
      <header className="top">
        <nav>
          <div className="brand">MoveLT <span>/ Lithuania</span></div>
          <div className="navlinks">
            {currentUser && <button type="button" className="nav-link-btn" onClick={() => {
              window.location.hash = '#profile';
              setShowProfilePage(true);
              setShowAdminPage(false);
            }}>Profile</button>}
            {currentUser && profile.isAdmin && <button type="button" className="nav-link-btn" onClick={openAdminPage}>Admin</button>}
            {currentUser && <button type="button" className="notification-nav-btn" aria-label="Notifications" title="Notifications" onClick={() => {
              window.location.hash = '#notifications';
              setShowNotificationsPage(true);
              setShowProfilePage(false);
              setShowAdminPage(false);
            }}>
              <span aria-hidden="true">🔔</span>
              {notifications.some((notification) => !notification.read_at) && (
                <span className="notification-count">{notifications.filter((notification) => !notification.read_at).length}</span>
              )}
            </button>}
            <a href="#explore">Explore</a>
            <a href="#how">How it works</a>
            <a href="#contribute">Contribute</a>
          </div>
          <div className="nav-actions">
            {currentUser ? (
              <>
                <span className="user-badge">Hi, {userDisplayName}</span>
                <button type="button" className="ghost-btn inline-btn" onClick={handleLogout}>Log out</button>
              </>
            ) : (
              <button type="button" className="ghost-btn inline-btn" onClick={() => setShowLoginModal(true)}>Log in</button>
            )}
            <a className="cta" href="#contribute">Share your experience</a>
          </div>
        </nav>
      </header>

      <main>
      {selectedPostId ? postPage : showNotificationsPage ? notificationsPage : showAdminPage && profile.isAdmin ? adminPage : showProfilePage ? profilePage : <>
        {submissionNotice.message && (
          <div className={`submit-status ${submissionNotice.type}`}>
            {submissionNotice.message}
          </div>
        )}

        <section className="hero">
          <div>
            <div className="badge">🇱🇹 Built from real experiences</div>
            <h1>See Lithuania through people who actually live here.</h1>
            <p>
              Honest dorm tours, university life, neighborhoods, language clubs,
              commuting tips and the little things nobody puts in an official guide.
            </p>
            <div className="search">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                placeholder="Try “VU dorms”, “Naujamiestis”, “language clubs”..."
                aria-label="Search experiences"
              />
              <button type="button" onClick={() => document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore
              </button>
            </div>
          </div>

          <div className="hero-card">
            <div>
              <div className="badge">🎥 Resident video</div>
              <h3>“What my VU dorm actually looks like”</h3>
              <p>Shot by a current student. No agency photos. No sponsored script.</p>
            </div>
            <div className="video-placeholder" role="button" tabIndex={0} onClick={() => alert('Prototype: this would open the full resident video.')}>▶</div>
          </div>
        </section>

        <section className="section" id="explore">
          <div className="section-head">
            <div>
              <h2>Explore real life</h2>
              <div className="section-sub">A starting set of community-made guides.</div>
            </div>
          </div>

          <div className="filter-row" aria-label="Content filters">
            {['all', 'housing', 'university', 'neighborhood', 'community'].map((filter) => (
              <button
                key={filter}
                type="button"
                className={`pill ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)}
              </button>
            ))}
          </div>

          <div className="grid" id="cards" aria-live="polite">
            {filteredCards.map((card) => {
              const cardId = card.id ?? `${card.title}-${card.author}`;
              const isSaved = savedGuides.includes(cardId);

              return (
                <article key={cardId} className="card" data-type={card.type} onClick={() => openPostPage(cardId)}>
                  <div className="thumb">
                    <div className="tag">{card.tag}</div>
                    {card.videoUrl ? (
                      card.mediaType === 'video' ? (
                        <video className="thumb-media" src={card.videoUrl} controls playsInline muted />
                      ) : (
                        <img className="thumb-media" src={card.videoUrl} alt={card.title} />
                      )
                    ) : (
                      <div className="play">▶</div>
                    )}
                  </div>
                  <div className="cardbody">
                    <div className="card-top-row">
                      <h3>{card.title}</h3>
                      <button type="button" className={isSaved ? 'save-btn saved' : 'save-btn'} onClick={(event) => { event.stopPropagation(); handleSaveGuide(cardId); }}>
                        {isSaved ? 'Saved' : 'Save'}
                      </button>
                    </div>
                    <div className="meta">{card.meta}</div>
                    <div className="quote">{card.quote}</div>
                    <div className="person">
                      <div className="avatar">{card.author.charAt(0)}</div>
                      <div>
                        <b>{card.author}</b>
                        <br />
                        <span>{card.role}</span>
                      </div>
                      <div className="rating">{card.rating}</div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="callout" id="contribute">
            <div>
              <h3>You already know something a newcomer needs.</h3>
              <p>
                Share a short video, photo walkthrough or honest guide. Your
                experience becomes someone else’s shortcut.
              </p>
            </div>
            <button type="button" className="outline" onClick={() => setShowContributorModal(true)}>Become a contributor</button>
          </div>
        </section>
        </>}
      </main>

      <footer id="how">
        <div>
          <span>MoveLT prototype · community-first relocation</span>
          <span>No agency listings in the community feed.</span>
        </div>
      </footer>

      {loginModal}

      {showProfileModal && (
        <div className="modal-backdrop" onClick={() => setShowProfileModal(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit profile</h3>
              <button type="button" className="close-btn" onClick={() => setShowProfileModal(false)}>×</button>
            </div>
            <form className="auth-form" onSubmit={handleSaveProfile}>
              <label>
                Display name
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(event) => setProfile({ ...profile, displayName: event.target.value })}
                  required
                />
              </label>
              <label>
                Profile picture
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleProfileAvatarChange}
                />
                {profileAvatarFile && <span className="file-name">Selected: {profileAvatarFile.name}</span>}
              </label>
              {profileAvatarPreview && (
                <div className="avatar-editor">
                  <div className="avatar-cropper">
                    <Cropper
                      image={profileAvatarPreview}
                      crop={profileCrop}
                      zoom={profileZoom}
                      aspect={1}
                      cropShape="round"
                      showGrid={false}
                      onCropChange={setProfileCrop}
                      onZoomChange={setProfileZoom}
                      onCropComplete={(_area, areaPixels) => setProfileCroppedAreaPixels(areaPixels)}
                    />
                  </div>
                  <label className="zoom-control">
                    Zoom
                    <input
                      type="range"
                      min="1"
                      max="3"
                      step="0.1"
                      value={profileZoom}
                      onChange={(event) => setProfileZoom(Number(event.target.value))}
                    />
                  </label>
                </div>
              )}
              <label>
                City
                <input
                  type="text"
                  value={profile.city}
                  onChange={(event) => setProfile({ ...profile, city: event.target.value })}
                  placeholder="Vilnius"
                />
              </label>
              <label>
                Bio
                <textarea
                  rows="4"
                  value={profile.bio}
                  onChange={(event) => setProfile({ ...profile, bio: event.target.value })}
                  placeholder="Tell the community a little about yourself."
                />
              </label>
              {profileNotice && <p className="auth-error">{profileNotice}</p>}
              <button type="submit" className="primary-btn full-width" disabled={profileLoading}>
                {profileLoading ? 'Saving...' : 'Save profile'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showContributorModal && (
        <div className="modal-backdrop" onClick={() => setShowContributorModal(false)}>
          <div className="modal-card large" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingContribution ? 'Edit your experience' : 'Share your experience'}</h3>
              <button type="button" className="close-btn" onClick={() => setShowContributorModal(false)}>×</button>
            </div>
            <form className="contribution-form" onSubmit={handleSubmitContribution}>
              <div className="input-grid">
                <label>
                  Your name
                  <input
                    type="text"
                    value={submissionForm.name}
                    onChange={(event) => setSubmissionForm({ ...submissionForm, name: event.target.value })}
                    placeholder="Jane Doe"
                  />
                </label>
                <label>
                  City
                  <input
                    type="text"
                    value={submissionForm.city}
                    onChange={(event) => setSubmissionForm({ ...submissionForm, city: event.target.value })}
                    placeholder="Vilnius"
                  />
                </label>
              </div>

              <label>
                Story title
                <input
                  type="text"
                  value={submissionForm.title}
                  onChange={(event) => setSubmissionForm({ ...submissionForm, title: event.target.value })}
                  placeholder="What I wish I knew before moving"
                  required
                />
              </label>

              <label>
                Category
                <select
                  value={submissionForm.category}
                  onChange={(event) => setSubmissionForm({ ...submissionForm, category: event.target.value })}
                >
                  <option value="housing">Housing</option>
                  <option value="university">University</option>
                  <option value="neighborhood">Neighborhood</option>
                  <option value="community">Community</option>
                </select>
              </label>

              <label>
                Upload a video or photo
                <input
                  type="file"
                  accept="video/*,image/*"
                  onChange={handleMediaUpload}
                  disabled={Boolean(editingContribution)}
                />
                {submissionForm.videoName && <span className="file-name">Selected: {submissionForm.videoName}</span>}
                {editingContribution && <span className="file-name">Media stays unchanged when editing.</span>}
              </label>

              <label>
                Tell us your experience
                <textarea
                  rows="5"
                  value={submissionForm.details}
                  onChange={(event) => setSubmissionForm({ ...submissionForm, details: event.target.value })}
                  placeholder="Share something helpful for someone moving here..."
                  required
                />
              </label>

              {submissionNotice.message && submissionNotice.type === 'error' && (
                <p className="submission-error">{submissionNotice.message}</p>
              )}

              <button type="submit" className="primary-btn full-width" disabled={isUploadingMedia}>
                {isUploadingMedia ? 'Uploading...' : editingContribution ? 'Save changes' : 'Submit contribution'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
