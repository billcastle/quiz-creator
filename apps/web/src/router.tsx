import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
} from '@tanstack/react-router'
import { AuthenticatedLayout } from './layouts/AuthenticatedLayout'
import { TakeLayout } from './layouts/TakeLayout'
import { UnauthenticatedLayout } from './layouts/UnauthenticatedLayout'
import { isAuthenticatedStub } from './lib/auth-stub'
import DesignSystemPage from './pages/DesignSystemPage'
import HomePage from './pages/HomePage'
import QuizBuilderPage from './pages/QuizBuilderPage'
import QuizResultsPage from './pages/QuizResultsPage'
import QuizTakePage from './pages/QuizTakePage'
import SignInPage from './pages/SignInPage'
import SignUpPage from './pages/SignUpPage'
import SurveyBuilderPage from './pages/SurveyBuilderPage'
import SurveyResultsPage from './pages/SurveyResultsPage'
import SurveyTakePage from './pages/SurveyTakePage'

const rootRoute = createRootRoute({
  component: () => <Outlet />,
})

// Pathless layout route — wraps all authenticated pages
const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  component: AuthenticatedLayout,
  beforeLoad: () => {
    if (!isAuthenticatedStub()) {
      throw redirect({ to: '/sign-in' })
    }
  },
})

// Pathless layout route — wraps sign-in / sign-up
const unauthenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_unauthenticated',
  component: UnauthenticatedLayout,
})

// Pathless layout route — wraps taker-facing pages (no creator nav)
const takeRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_take',
  component: TakeLayout,
})

// --- Authenticated routes ---

const indexRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/',
  component: HomePage,
})

const quizNewRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/quiz/new',
  component: QuizBuilderPage,
})

const quizEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/quiz/$id/edit',
  component: QuizBuilderPage,
})

const quizResultsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/quiz/$id/results',
  component: QuizResultsPage,
})

const surveyNewRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: '/survey/new',
  component: SurveyBuilderPage,
})

const surveyEditRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
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

const quizTakeRoute = createRoute({
  getParentRoute: () => takeRoute,
  path: '/quiz/$id',
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
  authenticatedRoute.addChildren([
    indexRoute,
    quizNewRoute,
    quizEditRoute,
    quizResultsRoute,
    surveyNewRoute,
    surveyEditRoute,
    surveyResultsRoute,
  ]),
  unauthenticatedRoute.addChildren([signInRoute, signUpRoute]),
  takeRoute.addChildren([quizTakeRoute, surveyTakeRoute]),
  designSystemRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
