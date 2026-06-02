# I Got Tired of Miro. So I Built My Own Sticky Note Board.

Let me set the scene.

It's a Friday afternoon. Sprint retro. Someone shares a Miro link in Slack. Three people say they can't figure out how to add a card. One person is still on the free tier and can't edit. Somebody else accidentally deletes the entire frame. We spend fifteen minutes fixing the board before we even start the actual retro.

I've been in that situation more times than I want to admit. And every time I thought the same thing: this is a sticky note board. Why is it this complicated?

So a few weeks ago I sat down and built PostItUp. A real-time collaborative sticky note board for the web. It looks like an actual physical corkboard, anyone with the link can post without creating an account, and getting started takes about thirty seconds.

This is the full story of how it works, what I built it with, and where it's going.

---

## What It Actually Looks Like

![PostItUp Landing Page](./screenshots/landing.png)

Yeah. Paper texture. Dot grid background. Notes with washi tape. Push pins on project cards. Wobbly hand-drawn borders on everything.

I made a deliberate choice to go all-in on the physical aesthetic. Most tools in this space look like a SaaS dashboard. Clean, flat, efficient, soulless. That visual language is fine for serious project management. But for quick feedback sessions and retros, it creates this weird professional distance that makes people more guarded with what they write.

Sticky notes on a physical board feel disposable. They feel like you're allowed to be honest and messy. I wanted the digital version to feel the same way.

---

## Creating a Board

![New Board Creation Form](./screenshots/new-board.png)

Creating a board is one form. You give it a title, an optional description, a prompt for contributors (something like "What went well this sprint?" or "Drop your feedback here"), and then you make two decisions.

**Canvas mode.** This is the one I spent the most time on.

Free canvas is an open dot-grid. Notes land wherever you drop them. You can pan around with alt+drag or middle mouse. Zoom in and out with ctrl+scroll. Fully flexible, slightly chaotic in a good way.

Grid mode snaps everything to a 32-pixel grid automatically. Same freedom, but your notes align without you having to try. Way nicer when you're adding a lot of notes fast and don't want to spend time tidying.

Ruled lines puts horizontal notebook lines across the canvas. It changes the whole mood. Works really well for sequential feedback or when the content is naturally top-to-bottom rather than scattered.

**Visibility.** Public means anyone can find it and post. Link-only requires the URL but no account. Private is just you.

---

## The Canvas

![Board Canvas With Notes](./screenshots/canvas.png)

Double-click anywhere on the canvas to add a note. A modal pops up, you type, pick a color, add your name if you want attribution, and hit "Pin it". The note appears immediately.

And here's the part that makes it actually useful for live sessions: everyone watching the board sees your note appear in real time. No refresh. No polling. It just shows up.

Notes can be dragged around the canvas and the position saves to the database the moment you let go. Upvoted with a thumbs up. Deleted by the author or the board owner.

The canvas itself handles pan and zoom so you can spread notes out as much as you want. It's not infinite canvas in the Figma sense but it's large enough that you won't run out of space.

---

## Embedding It Anywhere

![Embed Panel in Board Settings](./screenshots/embed-panel.png)

This is the feature I think has the most utility for developers specifically.

Every board has an embed panel. You get three options.

**iFrame** is the simple one. One line drops the full canvas into any webpage with no extra configuration.

```html
<iframe 
  src="https://postitup.varshithvhegde.in/embed/your-board-slug" 
  width="100%" 
  height="600" 
  frameborder="0">
</iframe>
```

**Script tag** is more interesting. Add this to any website and it injects a floating "Leave a note" button in the corner. Click it and a slide-out drawer opens with the full board. The iframe only loads when someone actually clicks the button, so there's zero performance cost on pages where nobody interacts with it.

```html
<script 
  src="https://postitup.varshithvhegde.in/embed.js"
  data-board="your-board-slug"
  data-url="https://postitup.varshithvhegde.in">
</script>
```

I've used this on a few static HTML pages already and the whole setup takes about a minute.

**React / Next.js component** is what's coming next. More on that below.

---

## How It's Built (The Technical Part)

Stack first: **Next.js 16** with the App Router, **Supabase** for database and real-time, TypeScript throughout, and basically no UI libraries. Everything visual is hand-rolled CSS.

### The fonts and the wobbly borders

Two Google Fonts. Kalam for body text and labels, which is a handwriting font that stays legible at small sizes unlike most options in that category. Architects Daughter for headings, which has that slightly imperfect letterboard quality without going full crayon.

The wobbly borders on cards are a single SVG filter defined once in the layout and referenced everywhere:

```xml
<filter id="roughen">
  <feTurbulence 
    type="fractalNoise" 
    baseFrequency="0.04" 
    numOctaves="4" 
    seed="3" 
    result="noise" />
  <feDisplacementMap 
    in="SourceGraphic" 
    in2="noise" 
    scale="2.5" 
    xChannelSelector="R" 
    yChannelSelector="G" />
</filter>
```

The displacement map shifts pixels using fractal noise. The result looks hand-drawn without any canvas API or images involved. Apply it to any element with `filter: url(#roughen)` and it looks like someone sketched around it.

The washi tape is a semi-transparent div with a repeating linear gradient to simulate texture, and `mix-blend-mode: multiply` to make it sit naturally on top of whatever is underneath.

### Real-time notes

Supabase Realtime is a WebSocket layer on Postgres. You subscribe to change events on a table with a row-level filter, and Supabase pushes you the payloads directly.

```typescript
const channel = supabase
  .channel(`board:${board.id}`)
  .on("postgres_changes", {
    event: "INSERT",
    schema: "public",
    table: "notes",
    filter: `board_id=eq.${board.id}`
  }, (payload) => {
    setNotes(n =>
      n.find(x => x.id === payload.new.id)
        ? n
        : [...n, payload.new as Note]
    )
  })
  .on("postgres_changes", { event: "UPDATE", ... }, (payload) => {
    setNotes(n => n.map(x =>
      x.id === payload.new.id ? { ...x, ...payload.new } : x
    ))
  })
  .on("postgres_changes", { event: "DELETE", ... }, (payload) => {
    setNotes(n => n.filter(x => x.id !== payload.old.id))
  })
  .subscribe()
```

The INSERT handler checks if the note already exists locally before adding it. This prevents duplicates when you're the person who just added a note (your own optimistic update is already in state when the real-time event arrives).

### The drag position bug I spent too long on

Dragging notes was working visually but positions weren't saving correctly. The note would snap back to its old position on reload.

The problem was a stale closure. The `mouseup` handler was reading position from a React state snapshot that existed when the callback was created, not the current position after dragging.

The fix was a ref that gets updated on every `mousemove`:

```typescript
const dragging = useRef<{
  id: string
  ox: number      // original x
  oy: number      // original y  
  startX: number  // where mouse started
  startY: number
  finalX: number  // updated every mousemove
  finalY: number
} | null>(null)

// mousemove handler:
dragging.current.finalX = nx
dragging.current.finalY = ny

// mouseup handler:
const { id, finalX, finalY } = dragging.current
dragging.current = null
await supabase.from("notes").update({ x: finalX, y: finalY }).eq("id", id)
```

Refs are mutable and always give you the live value. State snapshots don't. Using a ref for drag tracking means mouseup always reads the actual final position regardless of React's render cycle.

### Security and RLS

Supabase Row Level Security policies determine what each user can do with each row. Without these, your entire database is accessible to anyone who has your anon key, which is embedded in the client and completely public.

The trickiest policy to get right was upvotes. I needed to stop clients from directly setting the upvotes column to any number they wanted. My first attempt used a `with check` that compared against a subquery back to the notes table. Postgres walked into an infinite loop: evaluating the policy triggered a read on notes, which triggered the policy again.

The actual solution was a `SECURITY DEFINER` function that owns the entire upvote operation:

```sql
create or replace function increment_upvote(note_id uuid, voter_fp text)
returns json
language plpgsql
security definer
as $$
declare
  already_voted boolean;
  new_count integer;
begin
  select exists(
    select 1 from note_votes 
    where note_votes.note_id = increment_upvote.note_id
    and voter_fingerprint = voter_fp
  ) into already_voted;

  if already_voted then
    return json_build_object('success', false, 'reason', 'already_voted');
  end if;

  insert into note_votes (note_id, voter_fingerprint)
  values (increment_upvote.note_id, voter_fp);

  update notes set upvotes = upvotes + 1
  where id = increment_upvote.note_id
  returning upvotes into new_count;

  return json_build_object('success', true, 'upvotes', new_count);
end;
$$;
```

The function runs with the database owner's permissions, not the calling user's. Direct inserts to `note_votes` are blocked at the RLS level. The only way to upvote is through this function, and the function enforces the one-vote-per-fingerprint rule atomically.

### GDPR

Two Postgres functions handle compliance. `export_user_data()` returns everything we hold about the user as JSON, which the frontend downloads as a file. `delete_user_account()` deletes all owned boards (which cascades to notes), anonymises contributions on other boards so the content stays but the attribution is wiped, deletes the profile, then deletes the auth record.

The account page exposes both of these directly with no hoops to jump through.

---

## What's Coming

**The npm package.** This is the one I'm most excited about finishing.

The iframe embed works well, but dropping a React component directly into your app is a better experience when you're already in a React codebase. The plan is a `<PostItBoard />` component with a proper TypeScript API, theming props, and SSR safety so it works in Next.js without hydration issues.

Something like:

```tsx
import { PostItBoard } from "postitup"

<PostItBoard
  board="your-board-slug"
  baseUrl="https://postitup.varshithvhegde.in"
  height={500}
/>
```

That's publishing to npm soon. If that's something you'd use, watch the GitHub repo.

**Lane mode.** Columns. Kanban-style layout for boards where you want things organized into categories. Think Liked / Meh / Disliked for product feedback, or What Went Well / What Didn't / Action Items for retros.

**Board templates.** Starting from scratch every time you want to run a retro gets old fast. Pre-built templates for common use cases so you can be up and running in ten seconds instead of thirty.

---

## Try It

Live: **[postitup.varshithvhegde.in](https://postitup.varshithvhegde.in)**

Source: **[github.com/Varshithvhegde/postitup](https://github.com/Varshithvhegde/postitup)**

Create a board. Share the link. See if it does what you need it to do.

If something is broken or you have an idea for a feature, open an issue on GitHub or email me directly at varshithvh@gmail.com.

---

*Varshith V Hegde is a backend and cloud developer based in Bengaluru. He works on high-performance systems and occasionally ships side projects. Find him on [GitHub](https://github.com/VarshithVHegde) and [Dev.to](https://dev.to/varshithvhegde).*

---

> **Screenshot checklist before publishing:**
> - `screenshots/landing.png` — the landing page at postitup.varshithvhegde.in
> - `screenshots/new-board.png` — the new board creation form at /new
> - `screenshots/canvas.png` — a live board with several notes on it
> - `screenshots/embed-panel.png` — the embed code panel (click the link icon in the board toolbar)
>
> **Dev.to tags:** `showdev` `webdev` `nextjs` `supabase` `opensource`
>
> **Title alternatives if you want options:**
> - "I got tired of Miro. So I built my own sticky note board."
> - "Building a real-time collaborative board with Next.js and Supabase"
> - "PostItUp: a sticky note board that looks like a real corkboard"
