import { Footer } from '../components/Footer';
import { Masthead } from '../components/Masthead';
import { RunInstructions } from '../components/RunInstructions';
import { SectionActivityWindow } from '../components/SectionActivityWindow';
import { SectionHero } from '../components/SectionHero';
import { SectionPrivacy } from '../components/SectionPrivacy';
import { SectionProof } from '../components/SectionProof';
import { SectionWorkflow } from '../components/SectionWorkflow';
import { skipLink } from '../content';

/**
 * The single Phase 0 route.
 *
 * Five sections and one run block, in the order the argument is made: what it
 * is, how it works, the rule it is strictest about, the artefact it produces,
 * and what it will not claim. Every section is a server component; the only
 * client code on the page is the theme toggle and the two scroll actions.
 */
export default function Page() {
  return (
    <>
      <Masthead />
      <main id={skipLink.targetId}>
        <SectionHero />
        <SectionWorkflow />
        <SectionActivityWindow />
        <SectionProof />
        <SectionPrivacy />
        <RunInstructions />
      </main>
      <Footer />
    </>
  );
}
