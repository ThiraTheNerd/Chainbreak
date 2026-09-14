const DIFFICULTIES = ['easy', 'medium', 'hard'];
const LAYERS = [1, 2, 3]; // 1=OWASP web, 2=container escape, 3=AWS/LocalStack

// Collects all errors before returning, same as env.js's required-vars check.
export function validateChallengePayload(body) {
  const errors = [];
  const {
    slug, title, description, layer, category,
    difficulty, points, flag, dockerImage,
  } = body ?? {};

  if (typeof slug !== 'string' || !/^[a-z0-9-]{3,100}$/.test(slug)) {
    errors.push('slug must be 3-100 chars, lowercase letters, digits and hyphens only');
  }
  if (typeof title !== 'string' || title.trim().length < 3) {
    errors.push('title must be at least 3 characters');
  }
  if (typeof description !== 'string' || description.trim() === '') {
    errors.push('description is required');
  }
  if (!LAYERS.includes(Number(layer))) {
    errors.push('layer must be 1, 2 or 3');
  }
  if (typeof category !== 'string' || category.trim() === '') {
    errors.push('category is required');
  }
  if (!DIFFICULTIES.includes(difficulty)) {
    errors.push(`difficulty must be one of: ${DIFFICULTIES.join(', ')}`);
  }
  if (!Number.isInteger(Number(points)) || Number(points) <= 0) {
    errors.push('points must be a positive integer');
  }
  if (typeof flag !== 'string' || flag.trim().length < 8) {
    errors.push('flag must be at least 8 characters');
  }
  if (dockerImage != null && typeof dockerImage !== 'string') {
    errors.push('dockerImage must be a string or omitted');
  }

  if (errors.length > 0) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    value: {
      slug: slug.trim(),
      title: title.trim(),
      description: description.trim(),
      layer: Number(layer),
      category: category.trim(),
      difficulty,
      points: Number(points),
      flag: flag.trim(),
      // Normalise absent → null. mysql2 THROWS on undefined bind values,
      // so never let undefined reach the repository.
      dockerImage: dockerImage ?? null,
    },
  };
}