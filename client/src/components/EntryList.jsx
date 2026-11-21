import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { apiFetch } from '../utils/api';

function dateKey(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateLabel(key) {
    return new Date(`${key}T12:00:00`).toLocaleDateString(undefined, {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
}

function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function handleBeforeUnload(event) {
    event.preventDefault();
    event.returnValue = '';
}

function SearchSnippet({ snippet, position, length }) {
    if (position < 0 || position + length > snippet.length) return snippet;
    return <>{snippet.slice(0, position)}<mark>{snippet.slice(position, position + length)}</mark>{snippet.slice(position + length)}</>;
}

function AutoGrowingTextarea({ value, label, placeholder, onChange, onBlur, onMount }) {
    const textarea = useRef(null);
    const observedWidth = useRef(0);

    const resize = useCallback(() => {
        const element = textarea.current;
        if (!element) return;
        const scroller = element.closest('[data-testid="virtuoso-scroller"]');
        const scrollTop = scroller?.scrollTop;
        element.style.height = 'auto';
        element.style.height = `${element.scrollHeight}px`;
        if (scroller && scrollTop !== undefined) scroller.scrollTop = scrollTop;
    }, []);

    useLayoutEffect(() => {
        resize();
    }, [value, resize]);

    useLayoutEffect(() => {
        onMount?.(textarea.current);
    }, [onMount]);

    useEffect(() => {
        const element = textarea.current;
        if (!element || typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(([entry]) => {
            const width = entry.contentRect.width;
            if (width !== observedWidth.current) {
                observedWidth.current = width;
                resize();
            }
        });
        observedWidth.current = element.parentElement.getBoundingClientRect().width;
        observer.observe(element.parentElement);
        return () => observer.disconnect();
    }, [resize]);

    return (
        <textarea
            ref={textarea}
            aria-label={label}
            value={value}
            rows={1}
            placeholder={placeholder}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
        />
    );
}

export default function EntryList({ onLogout, onCloseSidebar }) {
    const [dates, setDates] = useState([]);
    const [entries, setEntries] = useState({});
    const [loading, setLoading] = useState(true);
    const [saveStates, setSaveStates] = useState({});
    const [failedSaveKeys, setFailedSaveKeys] = useState(() => new Set());
    const [error, setError] = useState('');
    const today = localDateKey(new Date());
    const entryCache = useRef({});
    const requestedDates = useRef(new Set());
    const pendingEntryLoads = useRef(new Map());
    const saveTimers = useRef(new Map());
    const retryTimers = useRef(new Map());
    const retryAttempts = useRef(new Map());
    const dirtyEntries = useRef(new Map());
    const savesInFlight = useRef(new Map());
    const queuedSaves = useRef(new Set());
    const saveSequence = useRef(new Map());
    const appliedSequence = useRef(new Map());
    const beforeUnloadAttached = useRef(false);
    const flushRef = useRef(null);
    const virtuoso = useRef(null);
    const jumpTargetIndex = useRef(null);
    const jumpSettleTimer = useRef(null);
    const jumpHardTimer = useRef(null);
    const [activeDate, setActiveDate] = useState('');
    const [collapsedMonths, setCollapsedMonths] = useState({});
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searchTruncated, setSearchTruncated] = useState(false);
    const [pendingSelection, setPendingSelection] = useState(null);
    const pendingSelectionRef = useRef(null);
    const searchInput = useRef(null);
    const searchRequest = useRef(0);
    const initialTodayIndex = Math.max(0, dates.indexOf(today));

    const clearPendingSelection = useCallback(() => {
        pendingSelectionRef.current = null;
        setPendingSelection(null);
    }, []);

    const applyPendingSelection = useCallback((element, key) => {
        const pending = pendingSelectionRef.current;
        if (!pending || pending.dateKey !== key || pending.field !== 'body' || !element) return;
        const expression = new RegExp(`^(?:${pending.query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})$`, 'i');
        const text = element.value;
        const start = Math.min(Math.max(0, pending.start), text.length);
        const end = Math.min(text.length, start + Math.max(0, pending.length));
        if (expression.test(text.slice(start, end))) {
            element.focus({ preventScroll: true });
            element.setSelectionRange(start, end);
        }
        pendingSelectionRef.current = null;
        setPendingSelection(null);
    }, []);

    const handleTextareaMount = useCallback((element) => {
        const key = element?.closest('[data-journal-date]')?.dataset.journalDate;
        if (key) applyPendingSelection(element, key);
    }, [applyPendingSelection]);

    useLayoutEffect(() => {
        if (!pendingSelection) return;
        const textarea = document.querySelector(`[data-journal-date="${pendingSelection.dateKey}"] textarea`);
        if (textarea) applyPendingSelection(textarea, pendingSelection.dateKey);
    }, [pendingSelection, applyPendingSelection]);

    const groupedDates = dates.reduce((years, key) => {
        const [year, month] = key.split('-');
        years[year] ??= {};
        years[year][month] ??= [];
        years[year][month].push(key);
        return years;
    }, {});

    const updateActiveDate = useCallback(() => {
        const page = document.querySelector('.journal-page [data-testid="virtuoso-scroller"]') || document.querySelector('.journal-page');
        if (!page) return;
        const candidates = [...page.querySelectorAll('[data-journal-date]')];
        const visible = candidates
            .map((element) => ({ key: element.dataset.journalDate, top: element.getBoundingClientRect().top - page.getBoundingClientRect().top }))
            .filter(({ top }) => top < page.clientHeight && top + 180 > 0);
        if (!visible.length) return;
        const current = visible.filter(({ top }) => top <= 120).at(-1) || visible[0];
        setActiveDate(current.key);
    }, []);

    useEffect(() => {
        const page = document.querySelector('.journal-page [data-testid="virtuoso-scroller"]') || document.querySelector('.journal-page');
        page?.addEventListener('scroll', updateActiveDate, { passive: true });
        window.addEventListener('resize', updateActiveDate);
        updateActiveDate();
        return () => {
            page?.removeEventListener('scroll', updateActiveDate);
            window.removeEventListener('resize', updateActiveDate);
        };
    }, [updateActiveDate]);

    const clearJumpRetry = useCallback(() => {
        jumpTargetIndex.current = null;
        clearTimeout(jumpSettleTimer.current);
        clearTimeout(jumpHardTimer.current);
    }, []);

    const handleTotalListHeightChanged = useCallback(() => {
        const index = jumpTargetIndex.current;
        if (index === null) return;
        virtuoso.current?.scrollToIndex({ index, align: 'start', behavior: 'auto' });
        clearTimeout(jumpSettleTimer.current);
        jumpSettleTimer.current = setTimeout(clearJumpRetry, 150);
    }, [clearJumpRetry]);

    useEffect(() => {
        const cancelForManualInput = (event) => {
            if (jumpTargetIndex.current === null) return;
            if (event.type === 'keydown' && !['PageUp', 'PageDown', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            clearJumpRetry();
        };
        window.addEventListener('wheel', cancelForManualInput, { passive: true });
        window.addEventListener('touchstart', cancelForManualInput, { passive: true });
        window.addEventListener('keydown', cancelForManualInput);
        return () => {
            window.removeEventListener('wheel', cancelForManualInput);
            window.removeEventListener('touchstart', cancelForManualInput);
            window.removeEventListener('keydown', cancelForManualInput);
            clearJumpRetry();
        };
    }, [clearJumpRetry]);

    const jumpToDate = async (key) => {
        const index = dates.indexOf(key);
        if (index < 0) return;
        await flushPendingSave();
        setActiveDate(key);
        await loadWindow(index, index);
        clearJumpRetry();
        jumpTargetIndex.current = index;
        jumpHardTimer.current = setTimeout(clearJumpRetry, 2000);
        jumpSettleTimer.current = setTimeout(clearJumpRetry, 150);
        virtuoso.current?.scrollToIndex({ index, align: 'start', behavior: 'smooth' });
        const pending = pendingSelectionRef.current;
        if (pending?.dateKey === key) {
            applyPendingSelection(document.querySelector(`[data-journal-date="${key}"] textarea`), key);
        }
        onCloseSidebar?.();
    };

    const selectSearchMatch = (match, key, query) => {
        clearPendingSelection();
        if (match.field === 'body') {
            const selection = { dateKey: key, field: match.field, start: match.start, length: match.length, query };
            pendingSelectionRef.current = selection;
            setPendingSelection(selection);
        }
        jumpToDate(key);
    };

    useEffect(() => {
        let cancelled = false;
        async function loadDates() {
            try {
                const response = await apiFetch('/api/entries/dates');
                if (!response.ok) throw new Error('Failed to load entry dates');
                const knownDates = (await response.json()).map(dateKey);
                const allDates = [...new Set([...knownDates, today])].sort();
                if (!cancelled) setDates(allDates);
            } catch (err) {
                if (!cancelled) setError('Unable to load entry dates. Please try again.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        loadDates();
        return () => { cancelled = true; };
    }, [today]);

    const loadWindow = useCallback(async (startIndex, endIndex) => {
        if (!dates.length) return;
        const first = Math.max(0, startIndex - 2);
        const last = Math.min(dates.length - 1, endIndex + 2);
        const needed = dates.slice(first, last + 1).filter((key) =>
            !entryCache.current[key] && !requestedDates.current.has(key)
        );
        const pending = dates.slice(first, last + 1)
            .map((key) => pendingEntryLoads.current.get(key))
            .filter(Boolean);
        if (!needed.length && !pending.length) return;

        needed.forEach((key) => requestedDates.current.add(key));

        if (needed.length) {
            const query = new URLSearchParams();
            needed.forEach((key) => query.append('dates', key));
            const request = (async () => {
                try {
                    const response = await apiFetch(`/api/entries/range?${query.toString()}`);
                    if (!response.ok) throw new Error('Failed to load entries');
                    const loaded = await response.json();
                    const next = { ...entryCache.current };
                    for (const entry of loaded) {
                        const key = dateKey(entry.date);
                        next[key] = { ...entry, key, originalBody: entry.body };
                    }
                    // A missing date is a real empty day; cache it so it is not requested again.
                    needed.forEach((key) => {
                        if (!next[key]) next[key] = { key, body: '', originalBody: '', _id: null };
                    });
                    entryCache.current = next;
                    setEntries(next);
                } catch (err) {
                    setError('Unable to load entries. Please try again.');
                } finally {
                    needed.forEach((key) => {
                        requestedDates.current.delete(key);
                        pendingEntryLoads.current.delete(key);
                    });
                }
            })();
            needed.forEach((key) => pendingEntryLoads.current.set(key, request));
            pending.push(request);
        }
        await Promise.all(pending);
    }, [dates]);

    useEffect(() => {
        const query = searchQuery.trim();
        const requestId = ++searchRequest.current;
        if (!query) {
            setSearchResults([]);
            setSearchTruncated(false);
            return undefined;
        }
        const timer = setTimeout(async () => {
            try {
                const response = await apiFetch(`/api/entries/search?q=${encodeURIComponent(query)}`);
                if (!response.ok) throw new Error('Search failed');
                const result = await response.json();
                if (searchRequest.current === requestId) {
                    setSearchResults(result.matches || []);
                    setSearchTruncated(result.truncated === true);
                }
            } catch (err) {
                if (searchRequest.current === requestId) setError('Unable to search entries. Please try again.');
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const groupedSearchResults = searchResults.reduce((groups, match) => {
        const key = dateKey(match.date);
        groups[key] ??= [];
        groups[key].push(match);
        return groups;
    }, {});

    useEffect(() => {
        const handleShortcut = (event) => {
            const target = event.target;
            const typing = target instanceof HTMLElement && (target.isContentEditable || ['TEXTAREA', 'INPUT'].includes(target.tagName));
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault();
                searchInput.current?.focus();
            } else if (event.key === '/' && !typing) {
                event.preventDefault();
                searchInput.current?.focus();
            } else if (event.key === 'Escape' && target === searchInput.current) {
                setSearchQuery('');
                searchInput.current?.blur();
            }
        };
        window.addEventListener('keydown', handleShortcut);
        return () => window.removeEventListener('keydown', handleShortcut);
    }, []);

    const updateBody = (key, body) => {
        const updated = { ...entryCache.current, [key]: { ...entryCache.current[key], body } };
        entryCache.current = updated;
        setEntries(updated);
        if (body === updated[key].originalBody && !savesInFlight.current.has(key)) {
            dirtyEntries.current.delete(key);
            clearTimeout(retryTimers.current.get(key));
            retryTimers.current.delete(key);
            retryAttempts.current.delete(key);
            setSaveStates((current) => ({ ...current, [key]: 'saved' }));
        } else {
            dirtyEntries.current.set(key, body);
            clearTimeout(retryTimers.current.get(key));
            retryTimers.current.delete(key);
            retryAttempts.current.delete(key);
        }
        syncBeforeUnload();
        setSaveStates((current) => ({ ...current, [key]: 'pending' }));
        clearTimeout(saveTimers.current.get(key));
        saveTimers.current.set(key, setTimeout(() => saveEntry(key), 1000));
    };

    const syncBeforeUnload = () => {
        const shouldWarn = dirtyEntries.current.size > 0 || savesInFlight.current.size > 0;
        if (shouldWarn && !beforeUnloadAttached.current) {
            window.addEventListener('beforeunload', handleBeforeUnload);
            beforeUnloadAttached.current = true;
        } else if (!shouldWarn && beforeUnloadAttached.current) {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            beforeUnloadAttached.current = false;
        }
    };

    const saveEntry = async (key, { keepalive = false } = {}) => {
        clearTimeout(saveTimers.current.get(key));
        const currentFlight = savesInFlight.current.get(key);
        if (currentFlight) {
            queuedSaves.current.add(key);
            return currentFlight;
        }
        const entry = entryCache.current[key];
        const body = dirtyEntries.current.get(key);
        if (!entry || body === undefined || (!entry._id && !body.trim())) return;
        const isNew = !entry._id;
        const payload = JSON.stringify(isNew ? { body, date: `${key}T12:00:00` } : { body });
        if (keepalive && new TextEncoder().encode(payload).byteLength > 60 * 1024) return;
        const sequence = (saveSequence.current.get(key) || 0) + 1;
        saveSequence.current.set(key, sequence);
        setSaveStates((current) => ({ ...current, [key]: 'saving' }));
        const token = sessionStorage.getItem('token');
        const options = {
            method: isNew ? 'POST' : 'PUT',
            headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
            body: payload,
            ...(keepalive ? { keepalive: true } : {})
        };
        const request = (async () => {
            try {
                const response = await fetch(isNew ? '/api/entries' : `/api/entries/${entry._id}`, options);
                if (!response.ok) throw new Error('Failed to save entry');
                const result = await response.json();
                setFailedSaveKeys((current) => {
                    if (!current.has(key)) return current;
                    const next = new Set(current);
                    next.delete(key);
                    return next;
                });
                const latest = entryCache.current[key];
                const entryId = entry._id || result.entryId;
                clearTimeout(retryTimers.current.get(key));
                retryTimers.current.delete(key);
                retryAttempts.current.delete(key);
                if ((appliedSequence.current.get(key) || 0) <= sequence) {
                    appliedSequence.current.set(key, sequence);
                    const saved = { ...latest, _id: entryId, originalBody: body };
                    entryCache.current = { ...entryCache.current, [key]: saved };
                    setEntries(entryCache.current);
                    if (dirtyEntries.current.get(key) === body) {
                        dirtyEntries.current.delete(key);
                        clearTimeout(retryTimers.current.get(key));
                        retryTimers.current.delete(key);
                        retryAttempts.current.delete(key);
                    }
                }
                syncBeforeUnload();
                if (dirtyEntries.current.has(key)) {
                    queuedSaves.current.add(key);
                    setSaveStates((current) => ({ ...current, [key]: 'pending' }));
                } else {
                    setSaveStates((current) => ({ ...current, [key]: 'saved' }));
                }
            } catch {
                setFailedSaveKeys((current) => new Set(current).add(key));
                setSaveStates((current) => ({ ...current, [key]: 'error' }));
                if (dirtyEntries.current.has(key)) scheduleSaveRetry(key);
            } finally {
                savesInFlight.current.delete(key);
                syncBeforeUnload();
                if (queuedSaves.current.has(key) && dirtyEntries.current.has(key)) {
                    queuedSaves.current.delete(key);
                    saveEntry(key);
                }
            }
        })();
        savesInFlight.current.set(key, request);
        syncBeforeUnload();
        return request;
    };

    const scheduleSaveRetry = (key) => {
        if (!dirtyEntries.current.has(key) || retryTimers.current.has(key)) return;
        const attempt = retryAttempts.current.get(key) || 0;
        const delay = [2000, 5000, 10000][attempt] || 30000;
        retryAttempts.current.set(key, attempt + 1);
        retryTimers.current.set(key, setTimeout(() => {
            retryTimers.current.delete(key);
            if (dirtyEntries.current.has(key)) saveEntry(key);
        }, delay));
    };

    const flushPendingSave = useCallback(async ({ keepalive = false } = {}) => {
        const keys = [...dirtyEntries.current.keys()];
        keys.forEach((key) => {
            clearTimeout(saveTimers.current.get(key));
            clearTimeout(retryTimers.current.get(key));
            retryTimers.current.delete(key);
        });
        await Promise.all(keys.map((key) => saveEntry(key, { keepalive })));
    }, []);
    flushRef.current = flushPendingSave;

    useEffect(() => {
        const onVisibility = () => { if (document.visibilityState === 'hidden') flushRef.current?.({ keepalive: true }); };
        const onPageHide = () => flushRef.current?.({ keepalive: true });
        const onOnline = () => {
            [...dirtyEntries.current.keys()].forEach((key) => {
                clearTimeout(retryTimers.current.get(key));
                retryTimers.current.delete(key);
                saveEntry(key);
            });
        };
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('pagehide', onPageHide);
        window.addEventListener('online', onOnline);
        return () => {
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('pagehide', onPageHide);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            beforeUnloadAttached.current = false;
        };
    }, []);

    useEffect(() => () => {
        saveTimers.current.forEach(clearTimeout);
        retryTimers.current.forEach(clearTimeout);
    }, []);

    if (loading) return <p>Loading entries...</p>;

    return (
        <section className="journal-layout">
            <aside className="journal-sidebar" aria-label="Journal dates">
                <div className="sidebar-brand">Momo Journal</div>
                <input
                    ref={searchInput}
                    className="journal-search"
                    type="search"
                    aria-label="Search journal"
                    placeholder="Search…"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                />
                {searchQuery.trim().length > 0 ? <nav className="search-results" aria-label="Search results">
                    {searchResults.length ? Object.entries(groupedSearchResults).map(([key, matches]) => (
                        <div className="search-result-group" key={key}>
                            <h3>{dateLabel(key)}</h3>
                            {matches.map((match) => (
                                <button className="search-result" type="button" key={`${match.field}-${match.start}`} onClick={() => selectSearchMatch(match, key, searchQuery.trim())}>
                                    <small><SearchSnippet snippet={match.snippet} position={match.snippetStart} length={match.length} /></small>
                                </button>
                            ))}
                        </div>
                    )) : <p className="search-empty">No results</p>}
                    {searchTruncated && <p className="search-empty">Showing first {searchResults.length} matches</p>}
                </nav> : <nav>
                    {Object.entries(groupedDates).map(([year, months]) => (
                        <div className="journal-year" key={year}>
                            <h2>{year}</h2>
                            {Object.entries(months).map(([month, keys]) => (
                                <div className="journal-month" key={month}>
                                    <button className="month-toggle" type="button" aria-expanded={!collapsedMonths[`${year}-${month}`]} onClick={() => setCollapsedMonths((current) => ({ ...current, [`${year}-${month}`]: !current[`${year}-${month}`] }))}>
                                        {new Date(`${year}-${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long' })}
                                    </button>
                                    {!collapsedMonths[`${year}-${month}`] && keys.map((key) => (
                                        <button
                                            className={key === activeDate ? 'active' : ''}
                                            type="button"
                                            key={key}
                                            aria-current={key === activeDate ? 'date' : undefined}
                                            onClick={() => jumpToDate(key)}
                                        >
                                            {new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', weekday: 'short' })}
                                        </button>
                                    ))}
                                </div>
                            ))}
                        </div>
                    ))}
                </nav>}
                <small className="sidebar-save-status" aria-live="polite">{Object.values(saveStates).includes('error') ? 'Not saved' : dirtyEntries.current.size || savesInFlight.current.size ? 'Saving…' : Object.values(saveStates).includes('saved') ? 'Saved' : ''}</small>
                <button className="logout-button" type="button" onClick={async () => { await flushPendingSave(); onLogout(); }}>Log Out</button>
            </aside>
            <div className="journal-page">
            {error && <p role="alert" className="journal-error">{error}</p>}
            {dates.length > 0 && (
                <Virtuoso
                    ref={virtuoso}
                    data={dates}
                    style={{ height: '100%' }}
                    computeItemKey={(_, key) => key}
                    initialTopMostItemIndex={{ index: initialTodayIndex, align: 'start' }}
                    defaultItemHeight={180}
                    increaseViewportBy={200}
                    rangeChanged={({ startIndex, endIndex }) => loadWindow(startIndex, endIndex)}
                    totalListHeightChanged={handleTotalListHeightChanged}
                    itemContent={(_, key) => {
                        const entry = entries[key];
                        if (!entry) {
                        return <div className="journal-placeholder journal-item-content" aria-hidden="true" data-journal-date={key} />;
                        }
                        return (
                            <article className="journal-entry journal-item-content" data-journal-date={key}>
                                <h3>{dateLabel(key)}</h3>
                                <AutoGrowingTextarea
                                    label={`Entry for ${key}`}
                                    value={entry.body}
                                    placeholder={key === today ? 'Start writing...' : ''}
                                    onChange={(body) => updateBody(key, body)}
                                    onBlur={() => flushPendingSave()}
                                    onMount={handleTextareaMount}
                                />
                                {dirtyEntries.current.has(key) && failedSaveKeys.has(key) && <small className="journal-save-status" aria-live="polite">Not saved, retrying…</small>}
                            </article>
                        );
                    }}
                    components={{ Footer: () => <div className="journal-list-footer" aria-hidden="true" /> }}
                />
            )}
            </div>
        </section>
    );
}
