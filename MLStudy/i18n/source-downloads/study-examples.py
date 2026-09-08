# HD2Lab: independent worked examples. Requires NumPy.

# 데이터에서 학습까지
import numpy as np

X = np.array(
    [[18, 0.2, 24], [20, 0.1, 17], [22, 0.1, 12], [17, 0.6, 30], [16, 0.8, 28], [19, 0.3, 21]],
    dtype=float,
)
y = np.array([11, 14, 10, 6, 4, 9], dtype=float)
cut = 4  # 설명용 시간 분할. 실제 성능 판단에는 표본이 부족하다.
mu, scale = X[:cut].mean(0), X[:cut].std(0)
scale[scale == 0] = 1
X_valid = (X[cut:] - mu) / scale
baseline = np.full(len(y[cut:]), y[:cut].mean())
print("validation MSE:", np.mean((y[cut:] - baseline) ** 2))

# 예측을 만드는 수학
import numpy as np

rng = np.random.default_rng(1729)
x = rng.uniform(0, 1, 32)
y = 3 + 2 * x + 7 * x**3 + 0.7 * rng.normal(size=x.size)
Phi = np.polynomial.polynomial.polyvander(2 * x - 1, 3)
coef, _, rank, _ = np.linalg.lstsq(Phi, y, rcond=None)
query = np.array([0.25, 0.75, 1.15])
pred = np.polynomial.polynomial.polyval(2 * query - 1, coef)
print("rank:", rank, "prediction (ms):", pred)

# 모델을 개선하는 방법
import numpy as np

point = np.array([3.0, 2.0])
kappa, rate = 6.0, 0.15
losses = []
for step in range(45):
    losses.append((point[0] ** 2 + kappa * point[1] ** 2) / 2)
    point -= rate * np.array([point[0], kappa * point[1]])
print("final point:", point)
print("loss decreased:", losses[-1] < losses[0])

# 불확실성을 다루는 방법
import numpy as np

y = np.array([2.0, 3.0, 4.0, 3.0])
sigma2, prior_var, prior_mean = 4.0, 1.0, 0.0
post_var = 1 / (1 / prior_var + len(y) / sigma2)
post_mean = post_var * (prior_mean / prior_var + y.sum() / sigma2)
print("MLE:", y.mean(), "MAP:", post_mean)
print("predictive variance:", sigma2 + post_var)

# 정보를 압축하는 방법
import numpy as np

rng = np.random.default_rng(431)
latent = rng.normal(size=(180, 2))
A = np.array([[1, 0.1], [0.8, 0.4], [-0.4, 0.9], [0.2, -0.8], [0.6, 0.6], [-0.7, 0.2]])
X = latent @ A.T + 0.35 * rng.normal(size=(180, 6))
mu = X.mean(0)
centered = X - mu
U, s, Vt = np.linalg.svd(centered, full_matrices=False)
k = 2
restored = (centered @ Vt[:k].T) @ Vt[:k] + mu
error = np.sum((X - restored) ** 2) / len(X)
print(error, np.sum(s[k:] ** 2) / len(X))

# 숨은 집단을 찾는 방법
import numpy as np

# 행은 관측, 열은 성분. 값은 log(pi_k) + log N(x_i).
logp = np.array([[-2.1, -2.5], [-900.0, -902.0]])
shift = logp.max(axis=1, keepdims=True)
q = np.exp(logp - shift)
r = q / q.sum(axis=1, keepdims=True)
print(r)
assert np.allclose(r.sum(axis=1), 1)

# 분류 경계를 만드는 방법
import numpy as np

X = np.array([[-2, 0], [-1, 1], [1, 1], [2, 0]], dtype=float)
y = np.array([-1, -1, 1, 1])
w, b = np.array([1.0, 0.0]), 0.0
scores = X @ w + b
assert np.all(y * scores >= 1)
print("predictions:", np.where(scores >= 0, 1, -1))
print("margin width:", 2 / np.linalg.norm(w))
