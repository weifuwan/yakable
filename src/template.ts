import type { DesignIntentIR, ProjectTemplate } from './types.js';

const APP_INTENT_PATTERN =
  /\b(app|dashboard|admin|crm|erp|portal|workspace|account|auth|login|order|orders|settings)\b|管理系统|后台|控制台|工作台|登录|注册|账户|账号|订单|设置|会员中心|个人中心/i;
const WEBSITE_INTENT_PATTERN =
  /\b(website|landing page|homepage|marketing site|portfolio|brochure site)\b|官网|落地页|着陆页|营销网站|作品集/i;

export interface ProjectTemplateProfile {
  id: ProjectTemplate;
  description: string;
  preferredStructure: string[];
}

export const PROJECT_TEMPLATES: Record<ProjectTemplate, ProjectTemplateProfile> = {
  website: {
    id: 'website',
    description: 'A presentation-first website or landing page with a small route surface.',
    preferredStructure: ['src/components/', 'src/data/', 'src/App.tsx', 'src/routes.ts'],
  },
  app: {
    id: 'app',
    description: 'A multi-screen product application with explicit pages and route-aware navigation.',
    preferredStructure: ['src/components/', 'src/pages/', 'src/routes.ts', 'src/App.tsx'],
  },
};

function designIntentSearchText(designIntent: DesignIntentIR): string {
  return [
    designIntent.product.type,
    designIntent.product.surface,
    designIntent.product.primaryGoal,
    ...designIntent.requirements.map((requirement) => requirement.statement),
  ].join(' ');
}

export function selectProjectTemplate(
  prompt: string,
  designIntent?: DesignIntentIR,
): ProjectTemplate {
  if (designIntent) {
    const intentText = designIntentSearchText(designIntent);
    if (APP_INTENT_PATTERN.test(intentText)) {
      return 'app';
    }
    if (WEBSITE_INTENT_PATTERN.test(intentText)) {
      return 'website';
    }
  }

  return APP_INTENT_PATTERN.test(prompt) ? 'app' : 'website';
}

export function buildTemplateGenerationRequest(
  productRequest: string,
  template: ProjectTemplate,
  designIntent?: DesignIntentIR,
): string {
  const profile = PROJECT_TEMPLATES[template];
  return JSON.stringify(
    {
      productRequest,
      designIntent,
      projectTemplate: template,
      templateGuidance: {
        description: profile.description,
        preferredStructure: profile.preferredStructure,
      },
    },
    null,
    2,
  );
}
