import mongoose from 'mongoose';
import config from '../src/config.js';
import { connectDB, disconnectDB } from '../src/lib/db.js';
import { createJob } from '../src/services/jobService.js';
import logger from '../src/lib/logger.js';

const tenants = [
  { tenantId: 'tenant-acme', postedBy: new mongoose.Types.ObjectId() },
  { tenantId: 'tenant-globex', postedBy: new mongoose.Types.ObjectId() },
];

const jobTemplates = [
  ['Senior Backend Engineer', 'Build Node.js microservices and APIs for a high-volume SaaS platform.', ['node.js', 'express', 'mongodb', 'docker', 'rest']],
  ['Frontend React Engineer', 'Create accessible, responsive product experiences with React and TypeScript.', ['react', 'typescript', 'javascript', 'css', 'jest']],
  ['Platform Engineer', 'Operate reliable Kubernetes infrastructure and automate cloud deployments.', ['kubernetes', 'docker', 'terraform', 'aws', 'linux']],
  ['Data Engineer', 'Design batch and streaming pipelines for analytics using Python and SQL.', ['python', 'sql', 'kafka', 'postgresql', 'pandas']],
  ['Machine Learning Engineer', 'Train and deploy production NLP models and manage feature pipelines.', ['python', 'pytorch', 'tensorflow', 'pandas', 'machine learning']],
  ['DevOps Engineer', 'Improve CI/CD, observability, and infrastructure as code across engineering.', ['aws', 'terraform', 'jenkins', 'kubernetes', 'prometheus']],
  ['Full Stack Engineer', 'Deliver customer features across a React frontend and Node.js backend.', ['react', 'node.js', 'typescript', 'postgresql', 'docker']],
  ['Cloud Security Engineer', 'Secure cloud workloads with identity, network, and compliance controls.', ['aws', 'linux', 'kubernetes', 'terraform', 'cryptography']],
  ['QA Automation Engineer', 'Build reliable API and browser test automation for frequent releases.', ['playwright', 'cypress', 'javascript', 'typescript', 'ci/cd']],
  ['Site Reliability Engineer', 'Keep distributed services available through automation and measurable SLOs.', ['linux', 'kubernetes', 'prometheus', 'grafana', 'python']],
];

async function seed() {
  await connectDB({
    uri: config.MONGO_URI,
    maxRetries: config.DB_MAX_RETRIES,
    initialRetryDelayMs: config.DB_INITIAL_RETRY_DELAY_MS,
  });

  for (const [tenantIndex, tenant] of tenants.entries()) {
    for (const [title, description, requiredSkills] of jobTemplates) {
      await createJob({
        title,
        description,
        requiredSkills,
        tenantId: tenant.tenantId,
        postedBy: tenant.postedBy,
      });
    }
    logger.info({ tenantId: tenant.tenantId, tenantIndex: tenantIndex + 1 }, 'Seeded tenant jobs');
  }
}

try {
  await seed();
} finally {
  await disconnectDB();
}
