<?php
/**
 * Minta a titkos kulcsokhoz. Másold le config.secret.php néven (az a
 * .gitignore-ban van, sosem kerül fel GitHubra), és írd bele a kulcsot.
 * A szerverre kézzel töltsd fel a config.php mellé.
 */
return [
    'openai' => [
        'api_key' => 'sk-…',
        // 'model' => 'gpt-4o-mini',
    ],
];
