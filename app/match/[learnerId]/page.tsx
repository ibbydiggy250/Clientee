/**
 * Find a tutor (mvp-spec.md, "Matching"): the family's side of the flow.
 *
 *   1. Trials in progress → book the trial, then say how it went.
 *   2. Requests in progress → waiting on the tutor (48h) or on TutorMe.
 *   3. Suggestions → one recommended tutor and up to two alternates.
 *   4. The search form → what the learner needs.
 */
import Link from "next/link";

import matching from "@/components/matching/matching.module.css";
import { PaperPage, PenCircle } from "@/components/paper/PaperPage";
import paper from "@/components/paper/paper.module.css";
import { requireProfile } from "@/lib/auth/current-user";
import { formatSessionTime } from "@/lib/eastern-time";
import { getLearnerMatchPage, MatchingError, type LearnerMatchPage, type TutorCard } from "@/lib/matching";
import { levelLabel } from "@/lib/matching-options";

import { SignOutButton } from "../../home/SignOutButton";
import { askForAnotherAction } from "../actions";
import { RequestButton, TrialResultButtons } from "./MatchButtons";
import { SearchForm } from "./SearchForm";

export const dynamic = "force-dynamic";

function TutorProfileCard({ card, learnerId, recommended }: { card: TutorCard; learnerId: string; recommended: boolean }) {
  return (
    <article className={`${matching.tutorCard} ${recommended ? matching.recommended : ""}`}>
      {recommended && <span className={matching.recommendedStamp}>Recommended</span>}
      <span className={matching.monogram} aria-hidden>{card.name[0]}</span>
      <h3 className={matching.tutorName}>{card.name}</h3>
      {card.schoolYear && <span className={matching.quiet}>{card.schoolYear}</span>}
      <div className={matching.chips}>
        {[...card.subjects, ...card.levels].map((tag) => <span key={tag} className={matching.chip}>{tag}</span>)}
      </div>
      {card.bio ? <p className={matching.bio}>{card.bio}</p> : <p className={matching.quiet}>Bio coming soon.</p>}
      {card.introVideoUrl && (
        <a className={paper.link} href={card.introVideoUrl} target="_blank" rel="noreferrer noopener">
          Watch their intro video ↗
        </a>
      )}
      <RequestButton requestId={card.requestId} learnerId={learnerId} tutorName={card.name} primary={recommended} />
    </article>
  );
}

function RequestStatus({ request }: { request: LearnerMatchPage["requests"][number] }) {
  const lines: Record<string, string> = {
    requested: `Waiting for ${request.tutorName} to say yes${request.expiresAt ? ` — by ${formatSessionTime(request.expiresAt)} ET` : ""}.`,
    accepted: `${request.tutorName} said yes! TutorMe is giving it a final check.`,
    approved: `Matched with ${request.tutorName}.`,
    declined: `${request.tutorName} couldn't take this one.`,
    expired: `${request.tutorName} didn't answer in time.`,
  };
  const waiting = request.status === "requested" || request.status === "accepted";
  return (
    <div className={matching.statusCard}>
      {waiting ? <span className={matching.clock} aria-hidden /> : <span aria-hidden>{request.status === "approved" ? "✓" : "↺"}</span>}
      <div className={paper.field}>
        <span className={paper.heading}>{request.subject} · {request.level}</span>
        <span>{lines[request.status] ?? request.status}</span>
        {(request.status === "declined" || request.status === "expired") && (
          <span className={matching.quiet}>Search again below and we&apos;ll suggest someone else.</span>
        )}
      </div>
    </div>
  );
}

export default async function FindTutorPage({ params }: { params: Promise<{ learnerId: string }> }) {
  const { learnerId } = await params;
  const { user } = await requireProfile();

  let page: LearnerMatchPage;
  try {
    page = await getLearnerMatchPage(user, learnerId, new Date());
  } catch (problem) {
    if (!(problem instanceof MatchingError)) throw problem;
    return (
      <PaperPage action={<SignOutButton />}>
        <div className={`${paper.sheet} ${paper.narrow}`}>
          <p className={paper.note}>hmm —</p>
          <h1 className={`${paper.title} ${paper.titleSmall}`}>{problem.message}</h1>
          <Link className={paper.link} href="/home">← Back home</Link>
        </div>
      </PaperPage>
    );
  }

  const firstName = page.learnerName.split(" ")[0];
  const [recommended, ...alternates] = page.suggestions;
  const liveRequests = page.requests.filter((request) => request.status === "requested" || request.status === "accepted");
  const recentlyEnded = page.requests.filter((request) => request.status === "declined" || request.status === "expired").slice(0, 2);
  const knownSubjects = [...new Set([...page.learnerSubjects, ...page.requests.map((request) => request.subject)])];

  return (
    <PaperPage action={<SignOutButton />}>
      <div className={paper.sheet}>
        <p className={paper.note}>matching · {firstName.toLowerCase()}</p>
        <h1 className={`${paper.title} ${paper.titleSmall}`}>
          Find {firstName} a{" "}
          <span className={paper.circled}>
            tutor.
            <PenCircle />
          </span>
        </h1>

        {/* ---------- Trials ---------- */}
        {page.trials.map((trial) => (
          <section key={trial.enrollmentId} className={`${paper.card} ${paper.formCard} ${paper.fields}`} aria-label={`Trial with ${trial.tutorName}`}>
            <span className={`${paper.stamp} ${paper.stampDone}`}>Trial · {trial.subject}</span>
            {!trial.trialBooked && (
              <>
                <p>You&apos;re matched with {trial.tutorName}! Start with one trial session to see if it&apos;s a fit.</p>
                <Link className={paper.primary} href={`/book/${trial.enrollmentId}`}>Book the trial</Link>
              </>
            )}
            {trial.trialBooked && !trial.trialOver && <p>Your trial with {trial.tutorName} is booked. Come back here after it.</p>}
            {trial.trialOver && <TrialResultButtons enrollmentId={trial.enrollmentId} learnerId={learnerId} tutorName={trial.tutorName} />}
          </section>
        ))}

        {/* ---------- The last search found nobody ---------- */}
        {page.unmetSearch && !recommended && liveRequests.length === 0 && (
          <div className={matching.statusCard}>
            <span className={matching.clock} aria-hidden />
            <div className={paper.field}>
              <span className={paper.heading}>{page.unmetSearch.subject} · {levelLabel(page.unmetSearch.level)}</span>
              <span>No tutor fits just yet, so TutorMe is finding {firstName} one by hand. We&apos;ll be in touch.</span>
            </div>
          </div>
        )}

        {/* ---------- Requests in progress ---------- */}
        {[...liveRequests, ...recentlyEnded].map((request) => <RequestStatus key={request.id} request={request} />)}

        {/* ---------- Suggestions ---------- */}
        {recommended && (
          <section className={paper.fields} aria-labelledby="suggestions-heading">
            <h2 id="suggestions-heading" className={paper.note}>we think {firstName.toLowerCase()} would click with ↓</h2>
            <div className={matching.cards}>
              <TutorProfileCard card={recommended} learnerId={learnerId} recommended />
              {alternates.length > 0 && (
                <div className={matching.alternates}>
                  {alternates.map((card) => <TutorProfileCard key={card.requestId} card={card} learnerId={learnerId} recommended={false} />)}
                </div>
              )}
            </div>
            <form action={askForAnotherAction}>
              <input type="hidden" name="learnerId" value={learnerId} />
              <input type="hidden" name="subject" value={recommended.searchedSubject} />
              <button type="submit" className={paper.link}>None of these — show me someone else</button>
            </form>
          </section>
        )}

        {/* ---------- Search ---------- */}
        {liveRequests.length === 0 && (
          <section className={paper.fields} aria-labelledby="search-heading">
            <h2 id="search-heading" className={paper.heading}>
              {recommended ? "Or start a new search" : `What does ${firstName} need?`}
            </h2>
            <SearchForm learnerId={learnerId} learnerName={page.learnerName} knownSubjects={knownSubjects} saved={page.preferences} />
          </section>
        )}

        <Link className={paper.link} href="/home">← Back home</Link>
      </div>
    </PaperPage>
  );
}
