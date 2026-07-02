import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { AuthenticatedLayout } from './layouts/AuthenticatedLayout'
import { BuilderLayout } from './layouts/BuilderLayout'
import { PublicLayout } from './layouts/PublicLayout'
import { TakeLayout } from './layouts/TakeLayout'
import { UnauthenticatedLayout } from './layouts/UnauthenticatedLayout'
import { authClient } from './lib/auth-client'
import DesignSystemPage from './pages/DesignSystemPage'
import HomePage from './pages/HomePage'
import QuizBuilderPage from './pages/QuizBuilderPage'
import QuizResultsPage from './pages/QuizResultsPage'
import QuizShortUrlPage from './pages/QuizShortUrlPage'
import QuizTakePage from './pages/QuizTakePage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import SurveyBuilderPage from './pages/SurveyBuilderPage'
import SurveyResultsPage from './pages/SurveyResultsPage'
import SurveyTakePage from './pages/SurveyTakePage'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

// Pathless layout route — wraps all authenticated pages (with sidebar/topnav)
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  component: AuthenticatedLayout,
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()
    if (!session) throw redirect({ to: '/sign-in' })
  },
})

// Pathless layout route — wraps builder pages (no sidebar, no topnav)
const builderRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_builder',
  component: BuilderLayout,
  beforeLoad: async () => {
    const { data: session } = await authClient.getSession()
    if (!session) throw redirect({ to: '/sign-in' })
  },
})

// Pathless layout route — wraps sign-in / sign-up
const unauthenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_unauthenticated',
  component: UnauthenticatedLayout,
})

// Pathless layout route — public pages with TopNav but no auth guard or SideNav
const publicRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_public',
  component: PublicLayout,
})

// Pathless layout route — wraps taker-facing pages (no creator nav)
const takeRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_take',
  component: TakeLayout,
})

// --- Public routes ---

const indexRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: '/',
  component: HomePage,
})

// --- Builder routes (auth required, no chrome) ---

const quizNewRoute = createRoute({
  getParentRoute: () => builderRoute,
  path: '/quiz/new',
  component: QuizBuilderPage,
})

const quizEditRoute = createRoute({
  getParentRoute: () => builderRoute,
  path: '/quiz/$shortId/edit',
  component: QuizBuilderPage,
})

// --- Authenticated routes (with sidebar/topnav) ---

const quizResultsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/quiz/$shortId/results',
  component: QuizResultsPage,
})

const surveyNewRoute = createRoute({
  getParentRoute: () => builderRoute,
  path: '/survey/new',
  component: SurveyBuilderPage,
})

const surveyEditRoute = createRoute({
  getParentRoute: () => builderRoute,
  path: '/survey/$id/edit',
  component: SurveyBuilderPage,
})

const surveyResultsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/survey/$id/results',
  component: SurveyResultsPage,
})

// --- Unauthenticated routes ---

const signInRoute = createRoute({
  getParentRoute: () => unauthenticatedRoute,
  path: '/sign-in',
  component: SignInPage,
})

const signUpRoute = createRoute({
  getParentRoute: () => unauthenticatedRoute,
  path: '/sign-up',
  component: SignUpPage,
})

// --- Take routes (public, isolated shell) ---

// /quiz/$shortId — redirect to /quiz/$shortId/$slug canonical URL
const quizShortUrlRoute = createRoute({
  getParentRoute: () => takeRoute,
  path: '/quiz/$shortId',
  component: QuizShortUrlPage,
})

// /quiz/$shortId/$slug — taker-facing quiz page
const quizTakeRoute = createRoute({
  getParentRoute: () => takeRoute,
  path: '/quiz/$shortId/$slug',
  component: QuizTakePage,
})

const surveyTakeRoute = createRoute({
  getParentRoute: () => takeRoute,
  path: '/survey/$id',
  component: SurveyTakePage,
})

// --- Design system (public, no layout wrapper) ---

const designSystemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/design-system',
  component: DesignSystemPage,
})

const routeTree = rootRoute.addChildren([
  publicRoute.addChildren([indexRoute]),
  authenticatedRoute.addChildren([quizResultsRoute, surveyResultsRoute]),
  builderRoute.addChildren([quizNewRoute, quizEditRoute, surveyNewRoute, surveyEditRoute]),
  unauthenticatedRoute.addChildren([signInRoute, signUpRoute]),
  takeRoute.addChildren([quizShortUrlRoute, quizTakeRoute, surveyTakeRoute]),
  designSystemRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
