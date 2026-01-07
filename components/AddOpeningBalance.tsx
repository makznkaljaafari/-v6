
import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { PageLayout } from './ui/Layout';
import { BaseInput } from './ui/atoms/BaseInput';
import { BaseSelect } from './ui/atoms/BaseSelect';
import { BaseButton } from './ui/atoms/BaseButton';
import { CurrencySwitcher } from './ui/molecules/Currency