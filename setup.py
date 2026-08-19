from setuptools import setup, find_packages

setup(
    name="danser-autofetch",
    version="1.0.0",
    description="Automated osu! replay video renderer with multi-mirror beatmap auto-fetcher and skin management for Danser.",
    author="heiznerd",
    url="https://github.com/heiznerd/danser-autofetch",
    packages=find_packages(),
    python_requires=">=3.8",
    entry_points={
        "console_scripts": [
            "danser-autofetch = danser_autofetch.cli:main",
            "danser-record = danser_autofetch.cli:main",
        ],
    },
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: POSIX :: Linux",
        "Topic :: Multimedia :: Video",
        "Topic :: Games/Entertainment",
    ],
)
